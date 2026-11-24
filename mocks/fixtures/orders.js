import { id } from './identifiers.js';
import { reservations, sampleItems } from './reservations.js';

export const orders = [
  {
    orderId: id(6, 1),
    sagaId: id(6, 1),
    reservationId: id(5, 1),
    paymentId: id(7, 1),
    username: 'marina',
    items: sampleItems,
    amountCents: 8000,
    status: 'CONFIRMED',
    sagaStatus: 'COMPLETED',
    createdAt: '2026-11-18T18:00:00Z',
    confirmedAt: '2026-11-18T18:01:00Z',
  },
  {
    orderId: id(6, 2),
    sagaId: id(6, 2),
    reservationId: id(5, 3),
    paymentId: id(7, 2),
    username: 'marina',
    items: reservations[2].items,
    amountCents: 16000,
    status: 'CANCELLED',
    sagaStatus: 'COMPENSATED',
    createdAt: '2026-11-17T17:00:00Z',
    failureCode: 'PAYMENT_DECLINED',
  },
];
