import { reservations, seats as seedSeats } from '../fixtures.js';
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
import { createStore, created, idempotency, ok } from '../core.js';

export function createReservations({ deps, now = Date.now }) {
  const store = createStore(reservations, 'reservationId'),
    once = idempotency();
  const seats = structuredClone(seedSeats);
  function expire() {
    for (const record of store.list()) {
      if (record.status === 'HELD' && Date.parse(record.expiresAt) <= now()) {
        record.status = 'EXPIRED';
        updateSeats(record, 'AVAILABLE');
      }
    }
  }
  function updateSeats(record, status) {
    for (const item of record.items)
      for (const seatId of item.seatIds) {
        const seat = seats.find((s) => s.sessionId === item.sessionId && s.seatId === seatId);
        if (seat) seat.status = status;
      }
  }
  function transition(id, action, payload = {}) {
    expire();
    const record = store.get(id);
    if (action === 'confirm') {
      if (record.status === 'EXPIRED')
        fail(410, 'RESERVATION_EXPIRED', 'O prazo da reserva terminou.');
      if (record.status === 'RELEASED')
        fail(409, 'INVALID_STATE_TRANSITION', 'Uma reserva liberada não pode ser confirmada.');
      record.status = 'CONFIRMED';
      record.confirmedAt ||= new Date(now()).toISOString();
      record.orderId ||= payload.orderId;
      updateSeats(record, 'SOLD');
    } else if (action === 'release') {
      if (record.status === 'CONFIRMED')
        fail(
          409,
          'INVALID_STATE_TRANSITION',
          'A liberação normal não cancela ingressos confirmados.',
        );
      if (record.status === 'HELD') {
        record.status = 'RELEASED';
        updateSeats(record, 'AVAILABLE');
      }
    } else if (action === 'cancel-confirmed') {
      // Extensão: mantém CONFIRMED terminal, marca cancelamento sem revenda automática.
      requireValue(record.status === 'CONFIRMED', 'A reserva precisa estar confirmada.');
      record.cancelledAt ||= new Date(now()).toISOString();
      record.cancellationReason = payload.reason;
    } else return notFound();
    return ok(record);
  }
  const domain = {
    async handle(method, parts, body, context, query) {
      expire();
      if (
        method === 'GET' &&
        parts[0] === 'sessions' &&
        parts[2] === 'seats' &&
        parts.length === 3
      ) {
        const items = seats.filter((s) => s.sessionId === parts[1]);
        if (!items.length) return notFound();
        return ok({ sessionId: parts[1], seats: items });
      }
      if (method === 'GET' && parts.length === 1)
        return ok(
          paginate(
            store
              .list()
              .filter((r) => !query.get('username') || r.username === query.get('username')),
            query,
          ),
        );
      if (method === 'GET' && parts.length === 2) return ok(store.get(parts[1]));
      if (method === 'POST' && parts.length === 3 && ['confirm', 'release'].includes(parts[2]))
        return transition(parts[1], parts[2], body);
      if (method === 'POST' && parts.length === 1)
        return once('hold', body, context, async () => {
          validateItems(body.items);
          requireValue(
            typeof body.username === 'string' &&
              body.username.trim().length >= 2 &&
              body.username.length <= 80,
            'Informe seu nome de usuário (2–80 caracteres).',
          );
          const ttl = body.expiresInSeconds ?? 600;
          requireValue(
            Number.isInteger(ttl) && ttl > 0 && ttl <= 600,
            'O prazo deve ser de 1 a 600 segundos.',
          );
          if (!context.internalCommand) {
            if (!context.admissionToken)
              fail(403, 'ADMISSION_REQUIRED', 'A admissão é obrigatória.');
            const admission = (
              await deps.request(
                'admissions',
                'POST',
                '/admissions/validate',
                { token: context.admissionToken },
                context,
              )
            ).body;
            requireValue(
              body.items.some((item) => item.sessionId === admission.sessionId),
              'A admissão deve corresponder a uma sessão da compra.',
            );
          }
          expire(); // Não há await entre verificar e adquirir todos os assentos no simulador.
          const requested = body.items.flatMap((item) =>
            item.seatIds.map((seatId) =>
              seats.find((s) => s.sessionId === item.sessionId && s.seatId === seatId),
            ),
          );
          if (
            context.scenario === 'seat-conflict' ||
            requested.some((s) => !s || s.status !== 'AVAILABLE')
          )
            fail(
              409,
              'SEAT_UNAVAILABLE',
              'Um dos assentos acabou de ser reservado. Escolha outro lugar.',
            );
          const record = store.put({
            reservationId: context.commandReservationId || uuid(),
            username: body.username.trim(),
            items: structuredClone(body.items),
            status: 'HELD',
            amountCents: requested.reduce((sum, s) => sum + s.priceCents, 0),
            expiresAt: new Date(
              now() +
                (['reservation-expired', 'late-payment'].includes(context.scenario)
                  ? 5000
                  : ttl * 1000),
            ).toISOString(),
          });
          updateSeats(record, 'HELD');
          return created(record);
        });
      return notFound();
    },
    async command(type, payload, context = {}) {
      if (type === 'reservation.hold') {
        requireValue(isUuid(payload.reservationId), 'reservationId deve ser UUID.');
        const { reservationId, orderId, ...body } = payload;
        const existing = store.records.get(reservationId);
        if (existing) {
          if (
            existing.username !== body.username ||
            canonical(existing.items) !== canonical(body.items)
          )
            fail(409, 'IDEMPOTENCY_KEY_REUSED', 'A reserva já existe com outros dados.');
          expire();
          return structuredClone(existing);
        }
        return (
          await domain.handle(
            'POST',
            ['reservations'],
            body,
            {
              ...context,
              internalCommand: true,
              commandReservationId: reservationId,
              idempotencyKey: `hold:${reservationId}`,
            },
            new URLSearchParams(),
          )
        ).body;
      }
      if (type === 'reservation.confirm')
        return transition(payload.reservationId, 'confirm', payload).body;
      if (type === 'reservation.release')
        return transition(payload.reservationId, 'release', payload).body;
      if (type === 'reservation.cancel')
        return transition(payload.reservationId, 'cancel-confirmed', payload).body;
      return notFound();
    },
  };
  return domain;
}
