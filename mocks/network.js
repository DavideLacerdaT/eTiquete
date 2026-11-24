import { createCatalog } from './services/catalog.js';
import { createAdmissions } from './services/admissions.js';
import { createReservations } from './services/reservations.js';
import { createOrders } from './services/orders.js';
import { createPayments } from './services/payments.js';
import { createNotifications } from './services/notifications.js';
import { contextWith } from './core.js';
import { envelope, fail, notFound, routeService } from '../shared/contracts.js';
import { scenarios } from './fixtures.js';

export const factories = {
  catalog: createCatalog,
  admissions: createAdmissions,
  reservations: createReservations,
  orders: createOrders,
  payments: createPayments,
  notifications: createNotifications,
};

export function createMockNetwork(options = {}) {
  let scenario = options.scenario || 'happy-path';

  const messages = [];

  const domains = {};

  const network = {
    get scenario() {
      return scenario;
    },
    messages,
    setScenario(value) {
      if (!scenarios.some((s) => s.id === value)) {
        throw new Error('Cenário inválido.');
      }

      scenario = value;
    },
    async request(service, method, path, body, context) {
      const ctx = contextWith({ scenario, ...context });

      if (ctx.scenario === 'unavailable') {
        fail(503, 'DEPENDENCY_UNAVAILABLE', 'Serviço indisponível no cenário de teste.');
      }

      const url = new URL(path, 'http://mock.local');

      const target = domains[service] || notFound();

      return target.handle(
        method,
        url.pathname.split('/').filter(Boolean),
        body || {},
        ctx,
        url.searchParams,
      );
    },
    async command(service, type, payload, context) {
      const ctx = contextWith({ scenario, ...context });

      if (!domains[service]?.command) {
        return notFound();
      }

      if (ctx.scenario === 'unavailable') {
        fail(503, 'DEPENDENCY_UNAVAILABLE', 'Comando indisponível no cenário de teste.');
      }

      const command = envelope(
        type,
        'orders-service',
        payload.orderId || payload.reservationId,
        payload,
        ctx,
      );

      messages.push({
        topic: `etiquete.${service}.commands`,
        key: command.aggregateId,
        ...command,
      });

      const result = await domains[service].command(type, payload, {
        ...ctx,
        messageId: command.messageId,
      });

      const typeMap = {
        'payment.charge': result.status === 'FAILED' ? 'payment.failed' : 'payment.succeeded',
        'payment.refund': 'payment.refunded',
        'reservation.hold': 'reservation.held',
        'reservation.confirm': 'reservation.confirmed',
        'reservation.release': 'reservation.released',
        'reservation.cancel': 'reservation.cancelled',
        'notification.send':
          result.status === 'FAILED' ? 'notification.failed' : 'notification.sent',
      };

      const event = envelope(
        typeMap[type] || type,
        `${service}-service`,
        command.aggregateId,
        result,
        { ...ctx, messageId: command.messageId },
      );

      messages.push({ topic: `etiquete.${service}.events`, key: event.aggregateId, ...event });

      return structuredClone(result);
    },
    async api(method, path, body, context) {
      return network.request(routeService(path) || notFound(), method, path, body, context);
    },
    async settled() {
      for (const domain of Object.values(domains)) {
        await domain.settled?.();
      }
    },
  };

  for (const [name, create] of Object.entries(factories)) {
    domains[name] = create({ ...options, deps: options.deps || network });
  }

  return network;
}
