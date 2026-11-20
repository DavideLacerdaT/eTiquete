import { payments } from '../fixtures.js';
import { canonical, fail, isUuid, notFound, requireValue, uuid } from '../../shared/contracts.js';
import { accepted, createStore, idempotency, ok, taskRunner, wait } from '../core.js';

export function createPayments({ delay = 600 }) {
  const store = createStore(payments, 'paymentId'),
    once = idempotency(),
    tasks = taskRunner(),
    charges = new Map(),
    refunds = new Map();
  async function charge(body, context) {
    requireValue(
      isUuid(body.orderId) &&
        isUuid(body.reservationId) &&
        Number.isSafeInteger(body.amountCents) &&
        body.amountCents > 0 &&
        body.currency === 'BRL' &&
        body.method === 'SIMULATED',
      'Pagamento inválido.',
    );
    const previous = charges.get(body.orderId);
    if (previous) {
      if (previous.fingerprint !== canonical(body))
        fail(409, 'IDEMPOTENCY_KEY_REUSED', 'O pedido já possui uma cobrança com outros valores.');
      return previous.result;
    }
    const seeded = store.list().find((p) => p.orderId === body.orderId);
    if (seeded) {
      requireValue(
        seeded.amountCents === body.amountCents && seeded.reservationId === body.reservationId,
        'A cobrança existente possui outros dados.',
      );
      return structuredClone(seeded);
    }
    const payment = store.put({ ...structuredClone(body), paymentId: uuid(), status: 'PENDING' });
    const result = (async () => {
      await wait(context.scenario === 'late-payment' ? Math.max(delay, 5500) : delay);
      const declined = context.scenario === 'payment-declined';
      Object.assign(
        payment,
        declined
          ? {
              status: 'FAILED',
              failureCode: 'PAYMENT_DECLINED',
              failedAt: new Date().toISOString(),
            }
          : { status: 'SUCCEEDED', paidAt: new Date().toISOString() },
      );
      return structuredClone(payment);
    })();
    charges.set(body.orderId, { fingerprint: canonical(body), result });
    return result;
  }
  async function refund(paymentId, context) {
    const record = store.get(paymentId);
    if (record.status === 'REFUNDED') return structuredClone(record);
    if (refunds.has(paymentId)) return refunds.get(paymentId);
    if (!['SUCCEEDED', 'REFUND_PENDING'].includes(record.status))
      fail(409, 'INVALID_STATE_TRANSITION', 'Somente pagamentos aprovados podem ser estornados.');
    record.status = 'REFUND_PENDING';
    const task = (async () => {
      await wait(delay);
      if (context.scenario === 'refund-failed')
        fail(503, 'DEPENDENCY_UNAVAILABLE', 'O estorno precisa ser reprocessado.');
      Object.assign(record, {
        status: 'REFUNDED',
        refundId: uuid(),
        refundedAt: new Date().toISOString(),
      });
      return structuredClone(record);
    })();
    refunds.set(paymentId, task);
    try {
      return await task;
    } finally {
      refunds.delete(paymentId);
    }
  }
  return {
    settled: tasks.settled,
    async command(type, payload, context) {
      if (type === 'payment.charge') return charge(payload, context);
      if (type === 'payment.refund') return refund(payload.paymentId, context);
      return notFound();
    },
    async handle(method, parts, body, context) {
      if (method === 'GET' && parts.length === 2) return ok(store.get(parts[1]));
      if (method === 'POST' && parts.length === 1)
        return once('charge', body, context, async () => {
          const previous = charges.get(body.orderId);
          if (previous && previous.fingerprint !== canonical(body))
            fail(
              409,
              'IDEMPOTENCY_KEY_REUSED',
              'O pedido já possui uma cobrança com outros valores.',
            );
          const existing = store.list().find((p) => p.orderId === body.orderId);
          if (
            existing &&
            ['orderId', 'reservationId', 'amountCents', 'currency', 'method'].some(
              (key) => existing[key] !== body[key],
            )
          )
            fail(409, 'IDEMPOTENCY_KEY_REUSED', 'A cobrança existente possui outros dados.');
          // Validação e criação ocorrem antes da resposta assíncrona.
          const operation = charge(body, context);
          const payment = store.list().find((p) => p.orderId === body.orderId);
          if (!payment) await operation;
          tasks.run(() => operation).catch(() => {});
          return accepted(payment);
        });
      if (method === 'POST' && parts[2] === 'refund' && parts.length === 3)
        return once(`refund:${parts[1]}`, body, context, async () => {
          const record = store.get(parts[1]);
          if (!['SUCCEEDED', 'REFUND_PENDING', 'REFUNDED'].includes(record.status))
            fail(409, 'INVALID_STATE_TRANSITION', 'Pagamento não estornável.');
          tasks.run(() => refund(parts[1], context)).catch(() => {});
          return accepted({
            paymentId: record.paymentId,
            status: record.status === 'REFUNDED' ? 'REFUNDED' : 'REFUND_PENDING',
          });
        });
      return notFound();
    },
  };
}
