import { id } from './identifiers.js';

export const notifications = [
  {
    notificationId: id(8, 1),
    orderId: id(6, 1),
    username: 'marina',
    template: 'ORDER_CONFIRMED',
    title: 'Seu lugar está garantido!',
    message: 'A compra de Entre Atos foi confirmada. Agora é só esperar o grande dia.',
    status: 'SENT',
    createdAt: '2026-11-18T18:01:00Z',
    sentAt: '2026-11-18T18:01:02Z',
  },
  {
    notificationId: id(8, 2),
    orderId: id(6, 2),
    username: 'marina',
    template: 'ORDER_CANCELLED',
    title: 'Compra cancelada',
    message:
      'O pagamento de Festival Solar foi recusado. Os assentos foram liberados para uma nova tentativa.',
    status: 'SENT',
    createdAt: '2026-11-17T17:01:00Z',
    sentAt: '2026-11-17T17:01:02Z',
  },
];
