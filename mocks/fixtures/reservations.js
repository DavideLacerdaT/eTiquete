import { id } from './identifiers.js';
import { sessions } from './catalog.js';

export const seats = sessions.flatMap((session, sessionIndex) =>
  Array.from({ length: 48 }, (_, i) => ({
    sessionId: session.sessionId,
    seatId: id(4, sessionIndex * 100 + i + 1),
    section: 'Plateia',
    row: String.fromCharCode(65 + Math.floor(i / 8)),
    number: String((i % 8) + 1).padStart(2, '0'),
    status: [3, 8, 11, 19, 20, 29, 34, 35, 46].includes(i) ? 'SOLD' : 'AVAILABLE',
    priceCents: session.priceCents,
  })),
);

export const sampleItems = [{ sessionId: id(2, 3), seatIds: [id(4, 204)] }];

export const reservations = [
  {
    reservationId: id(5, 1),
    username: 'marina',
    items: sampleItems,
    status: 'CONFIRMED',
    expiresAt: '2026-11-18T18:10:00Z',
    confirmedAt: '2026-11-18T18:01:00Z',
    amountCents: 8000,
    orderId: id(6, 1),
  },
  {
    reservationId: id(5, 2),
    username: 'marina',
    items: [{ sessionId: id(2, 1), seatIds: [id(4, 2)] }],
    status: 'EXPIRED',
    expiresAt: '2026-11-18T17:10:00Z',
    amountCents: 12000,
  },
  {
    reservationId: id(5, 3),
    username: 'marina',
    items: [{ sessionId: id(2, 4), seatIds: [id(4, 302)] }],
    status: 'RELEASED',
    expiresAt: '2026-11-17T17:10:00Z',
    amountCents: 16000,
  },
];
