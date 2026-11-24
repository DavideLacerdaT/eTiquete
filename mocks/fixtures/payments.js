import { id } from './identifiers.js';

export const payments = [
  {
    paymentId: id(7, 1),
    orderId: id(6, 1),
    reservationId: id(5, 1),
    amountCents: 8000,
    currency: 'BRL',
    method: 'SIMULATED',
    status: 'SUCCEEDED',
    paidAt: '2026-11-18T18:00:30Z',
  },
  {
    paymentId: id(7, 2),
    orderId: id(6, 2),
    reservationId: id(5, 3),
    amountCents: 16000,
    currency: 'BRL',
    method: 'SIMULATED',
    status: 'FAILED',
    failureCode: 'PAYMENT_DECLINED',
  },
];
