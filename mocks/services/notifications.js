import { notifications } from '../fixtures.js';
import { notFound, paginate, uuid } from '../../shared/contracts.js';
import { createStore, ok } from '../core.js';

export function createNotifications() {
  const store = createStore(notifications, 'notificationId');
  return {
    async command(type, payload, context) {
      if (type !== 'notification.send') return notFound();
      const old = store
        .list()
        .find((n) => n.orderId === payload.orderId && n.template === payload.template);
      if (old) return structuredClone(old);
      const confirmed = payload.template === 'ORDER_CONFIRMED',
        failed = context.scenario === 'notification-failed';
      return store.put({
        notificationId: uuid(),
        orderId: payload.orderId,
        username: payload.username,
        template: payload.template,
        title: confirmed ? 'Seu lugar está garantido!' : 'Cancelamento concluído',
        message: confirmed
          ? 'Pagamento aprovado e ingressos confirmados. Aproveite o evento!'
          : 'A compra foi cancelada e as compensações foram concluídas.',
        status: failed ? 'FAILED' : 'SENT',
        failureCode: failed ? 'DELIVERY_FAILED' : null,
        createdAt: new Date().toISOString(),
        sentAt: failed ? null : new Date().toISOString(),
      });
    },
    async handle(method, parts, body, context, query) {
      if (method === 'GET' && parts.length === 1)
        return ok(
          paginate(
            store
              .list()
              .filter((n) => !query.get('username') || n.username === query.get('username'))
              .reverse(),
            query,
          ),
        );
      if (method === 'GET' && parts.length === 2) return ok(store.get(parts[1]));
      return notFound();
    },
  };
}
