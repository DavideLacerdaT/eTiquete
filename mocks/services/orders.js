import { orders } from '../fixtures.js';
import {
  canonical,
  fail,
  isUuid,
  notFound,
  paginate,
  requireValue,
  uuid,
  validateItems,
} from '../../shared/contracts.js';
import { accepted, createStore, idempotency, ok, taskRunner, wait } from '../core.js';

export function createOrders({ deps, delay = 500 }) {
  const store = createStore(orders, 'orderId');

  const once = idempotency();

  const tasks = taskRunner();

  const timelines = new Map(
    orders.map((order) => [
      order.orderId,
      [
        { status: 'PENDING', label: 'Pedido recebido', occurredAt: order.createdAt },
        {
          status: order.status,
          label:
            order.status === 'CONFIRMED'
              ? 'Ingresso confirmado'
              : 'Pagamento recusado; reserva liberada',
          occurredAt: order.confirmedAt || order.createdAt,
        },
      ],
    ]),
  );

  const labels = {
    PENDING: 'Pedido recebido',
    RESERVED: 'Reserva validada',
    PAYMENT_PENDING: 'Pagamento em processamento',
    PAID: 'Pagamento aprovado',
    CONFIRMED: 'Ingressos confirmados',
    REFUND_PENDING: 'Estorno em processamento',
    CANCELLED: 'Compra cancelada',
    FAILED: 'Não foi possível concluir',
  };

  function move(order, status, sagaStatus = 'RUNNING', extra = {}) {
    Object.assign(order, { status, sagaStatus, ...extra });

    timelines
      .get(order.orderId)
      .push({ status, label: labels[status], occurredAt: new Date().toISOString() });
  }

  async function notify(order, context) {
    try {
      await deps.command(
        'notifications',
        'notification.send',
        {
          orderId: order.orderId,
          username: order.username,
          template: order.status === 'CONFIRMED' ? 'ORDER_CONFIRMED' : 'ORDER_CANCELLED',
          data: { amountCents: order.amountCents },
        },
        context,
      );
    } catch (error) {
      order.notificationError = error.code || 'DELIVERY_FAILED';
    }
  }

  async function compensate(order, context, payment) {
    try {
      if (payment?.status === 'SUCCEEDED') {
        move(order, 'REFUND_PENDING', 'COMPENSATING');

        await deps.command(
          'payments',
          'payment.refund',
          { orderId: order.orderId, paymentId: payment.paymentId, reason: 'RESERVATION_EXPIRED' },
          context,
        );
      }

      await deps.command(
        'reservations',
        'reservation.release',
        { orderId: order.orderId, reservationId: order.reservationId, reason: order.failureCode },
        context,
      );

      move(order, 'CANCELLED', 'COMPENSATED');

      await notify(order, context);
    } catch (error) {
      order.sagaStatus = 'MANUAL_INTERVENTION';

      order.lastError = error.code || 'DEPENDENCY_UNAVAILABLE';
    }
  }

  async function runSaga(order, context) {
    let payment;

    try {
      await wait(delay);

      move(order, 'RESERVED');

      move(order, 'PAYMENT_PENDING');

      payment = await deps.command(
        'payments',
        'payment.charge',
        {
          orderId: order.orderId,
          reservationId: order.reservationId,
          amountCents: order.amountCents,
          currency: 'BRL',
          method: 'SIMULATED',
        },
        context,
      );

      order.paymentId = payment.paymentId;

      if (payment.status !== 'SUCCEEDED') {
        order.failureCode = payment.failureCode || 'PAYMENT_DECLINED';

        return compensate(order, context);
      }

      move(order, 'PAID');

      await deps.command(
        'reservations',
        'reservation.confirm',
        { orderId: order.orderId, reservationId: order.reservationId },
        context,
      );

      move(order, 'CONFIRMED', 'COMPLETED', { confirmedAt: new Date().toISOString() });

      await notify(order, context);
    } catch (error) {
      order.failureCode = error.code || 'DEPENDENCY_UNAVAILABLE';
      // Timeout pode esconder uma cobrança concluída. Não declarar compensação sem evidência.

      if (!payment && error.status >= 500) {
        order.sagaStatus = 'MANUAL_INTERVENTION';

        return;
      }

      await compensate(order, context, payment);
    }
  }

  return {
    settled: tasks.settled,
    async handle(method, parts, body, context, query) {
      if (method === 'GET' && parts.length === 1) {
        return ok(
          paginate(
            store
              .list()
              .filter((o) => !query.get('username') || o.username === query.get('username'))
              .reverse(),
            query,
          ),
        );
      }

      if (method === 'GET' && parts.length === 2) {
        return ok(store.get(parts[1]));
      }

      if (method === 'GET' && parts[2] === 'timeline' && parts.length === 3) {
        store.get(parts[1]);

        return ok({ orderId: parts[1], items: timelines.get(parts[1]) });
      }

      if (method === 'POST' && parts.length === 1) {
        return once('create', body, context, async () => {
          validateItems(body.items);

          requireValue(
            isUuid(body.reservationId) &&
              typeof body.username === 'string' &&
              body.username.trim().length >= 2 &&
              body.paymentMethod === 'SIMULATED',
            'Revise os dados do pedido.',
          );

          if (!context.admissionToken) {
            fail(403, 'ADMISSION_REQUIRED', 'A admissão é obrigatória.');
          }

          await deps.request(
            'admissions',
            'POST',
            '/admissions/validate',
            { token: context.admissionToken },
            context,
          );

          const reservation = (
            await deps.request(
              'reservations',
              'GET',
              `/reservations/${body.reservationId}`,
              undefined,
              context,
            )
          ).body;

          if (
            reservation.status === 'EXPIRED' ||
            (reservation.status === 'HELD' && Date.parse(reservation.expiresAt) <= Date.now())
          ) {
            fail(410, 'RESERVATION_EXPIRED', 'A reserva expirou. Selecione os lugares novamente.');
          }

          if (reservation.status !== 'HELD') {
            fail(409, 'INVALID_STATE_TRANSITION', 'A reserva não está ativa.');
          }

          requireValue(
            reservation.username === body.username &&
              canonical(reservation.items) === canonical(body.items),
            'O pedido deve conter os mesmos itens e usuário da reserva.',
          );

          if (store.list().some((o) => o.reservationId === body.reservationId)) {
            fail(409, 'INVALID_STATE_TRANSITION', 'Esta reserva já está vinculada a um pedido.');
          }

          const orderId = uuid();

          const order = store.put({
            orderId,
            sagaId: orderId,
            reservationId: body.reservationId,
            username: body.username,
            items: structuredClone(body.items),
            amountCents: reservation.amountCents,
            status: 'PENDING',
            sagaStatus: 'RUNNING',
            createdAt: new Date().toISOString(),
            correlationId: context.correlationId,
          });

          timelines.set(orderId, [
            { status: 'PENDING', label: labels.PENDING, occurredAt: order.createdAt },
          ]);

          const response = accepted(order);

          tasks.run(() => runSaga(order, context));

          return response;
        });
      }

      if (method === 'POST' && parts[2] === 'cancel' && parts.length === 3) {
        return once(`cancel:${parts[1]}`, body, context, async () => {
          const order = store.get(parts[1]);

          requireValue(body.reason === 'CUSTOMER_REQUEST', 'Informe o motivo CUSTOMER_REQUEST.');

          if (
            order.status === 'REFUND_PENDING' ||
            (order.status === 'CANCELLED' && order.cancelReason)
          ) {
            return accepted(order);
          }

          if (order.status !== 'CONFIRMED') {
            fail(
              409,
              'INVALID_STATE_TRANSITION',
              'Somente compras confirmadas podem ser canceladas.',
            );
          }

          order.cancelReason = body.reason;

          move(order, 'REFUND_PENDING', 'COMPENSATING');

          tasks.run(async () => {
            try {
              await deps.command(
                'payments',
                'payment.refund',
                { orderId: order.orderId, paymentId: order.paymentId, reason: body.reason },
                context,
              );

              await deps.command(
                'reservations',
                'reservation.cancel',
                { orderId: order.orderId, reservationId: order.reservationId, reason: body.reason },
                context,
              );

              move(order, 'CANCELLED', 'COMPENSATED');

              await notify(order, context);
            } catch (error) {
              order.lastError = error.code || 'DEPENDENCY_UNAVAILABLE';

              order.sagaStatus = 'MANUAL_INTERVENTION';
            }
          });

          return accepted(order);
        });
      }

      return notFound();
    },
  };
}
