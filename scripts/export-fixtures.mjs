import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { format } from 'prettier';
import { API_BASE_PATH, httpOperations } from '../shared/http-contract.js';
import {
  events,
  sessions,
  venues,
  seats,
  reservations,
  orders,
  payments,
  notifications,
  scenarios,
  id,
  sampleItems,
} from '../mocks/fixtures.js';

const directory = new URL('../mocks/contracts/', import.meta.url);

await mkdir(directory, { recursive: true });

const formatting = JSON.parse(
  await readFile(new URL('../.prettierrc.json', import.meta.url), 'utf8'),
);

async function writeJson(filename, content) {
  const formatted = await format(JSON.stringify(content), { ...formatting, parser: 'json' });

  await writeFile(new URL(filename, directory), formatted);
}

const headers = {
  'Content-Type': 'application/json',
  'X-Correlation-Id': id(9, 1),
  'Idempotency-Key': id(9, 2),
  'X-Admission-Token': 'fixture-admission-token',
};

const error = (status, code, message) => ({
  status,
  body: { error: { code, message, details: {}, correlationId: headers['X-Correlation-Id'] } },
});

const list = (items) => ({
  items,
  pagination: { page: 1, limit: 20, totalItems: items.length, totalPages: items.length ? 1 : 0 },
});

const example = (method, path, status, response, request = null, errors = []) => ({
  request: { method, path: `/api/v1${path}`, headers, body: request },
  response: {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Correlation-Id': headers['X-Correlation-Id'],
    },
    body: response,
  },
  errors,
});

const invalid = error(400, 'VALIDATION_ERROR', 'Revise os campos informados.');

const missing = error(404, 'RESOURCE_NOT_FOUND', 'Recurso não encontrado.');

const reused = error(409, 'IDEMPOTENCY_KEY_REUSED', 'Esta chave já foi usada com outro conteúdo.');

const unavailable = error(503, 'DEPENDENCY_UNAVAILABLE', 'Dependência indisponível.');

const held = {
  reservationId: id(5, 4),
  username: 'marina',
  items: [{ sessionId: id(2, 1), seatIds: [id(4, 1)] }],
  status: 'HELD',
  expiresAt: '2026-11-19T15:10:00Z',
  amountCents: 12000,
};

const eventViews = events.map((event) => ({
  ...event,
  venue: venues.find((v) => v.venueId === event.venueId),
  sessions: sessions.filter((s) => s.eventId === event.eventId),
}));

const pendingPayment = {
  paymentId: id(7, 3),
  orderId: id(6, 3),
  reservationId: held.reservationId,
  amountCents: 12000,
  currency: 'BRL',
  method: 'SIMULATED',
  status: 'PENDING',
};

const admitted = {
  admissionTokenId: id(10, 1),
  eventId: id(1, 1),
  sessionId: id(2, 1),
  status: 'ADMITTED',
  token: 'fixture-admission-token',
  expiresAt: '2026-11-19T15:10:00Z',
};

const files = {
  gateway: {
    responsibility: 'Entrada HTTP única; roteamento e propagação de correlação.',
    fixtures: {
      baseUrl: API_BASE_PATH,
      operations: httpOperations,
    },
    examples: [
      example('GET', '/_dev/services', 200, {
        service: 'gateway',
        dependencies: Object.fromEntries(
          ['catalog', 'admissions', 'reservations', 'orders', 'payments', 'notifications'].map(
            (s) => [s, { mode: 'mock' }],
          ),
        ),
      }),
    ],
    errors: [error(429, 'RATE_LIMITED', 'Limite de requisições atingido.'), unavailable],
  },
  catalog: {
    responsibility: 'Eventos, sessões e locais.',
    fixtures: { events: eventViews, sessions, venues },
    examples: [
      example('GET', '/events', 200, list(eventViews)),
      example('GET', `/events/${id(1, 1)}`, 200, eventViews[0], null, [missing]),
      example('GET', `/events/${id(1, 1)}/sessions`, 200, { items: sessions.slice(0, 2) }),
      example('GET', `/sessions/${id(2, 1)}`, 200, { ...sessions[0], venue: venues[0] }),
      example('GET', `/sessions/${id(2, 1)}/seats`, 200, {
        sessionId: id(2, 1),
        seats: seats.filter((s) => s.sessionId === id(2, 1)),
      }),
    ],
  },
  admissions: {
    responsibility: 'Fila, admissão e TTL do token.',
    fixtures: {
      waiting: {
        admissionTokenId: id(10, 1),
        status: 'WAITING',
        position: 8,
        estimatedWaitSeconds: 8,
      },
      admitted,
    },
    examples: [
      example('POST', '/admissions', 202, admitted, { eventId: id(1, 1), sessionId: id(2, 1) }, [
        invalid,
      ]),
      example('GET', `/admissions/${id(10, 1)}`, 200, admitted, null, [missing]),
      example(
        'POST',
        '/admissions/validate',
        200,
        { valid: true, ...admitted },
        { token: admitted.token },
        [error(403, 'ADMISSION_REQUIRED', 'Admissão ausente ou expirada.')],
      ),
    ],
  },
  reservations: {
    responsibility: 'Inventário, aquisição atômica, confirmação, liberação e expiração.',
    fixtures: { seats, reservations: [...reservations, held] },
    examples: [
      example('GET', '/reservations?username=marina', 200, list(reservations)),
      example(
        'POST',
        '/reservations',
        201,
        held,
        { username: held.username, items: held.items, expiresInSeconds: 600 },
        [
          invalid,
          reused,
          error(409, 'SEAT_UNAVAILABLE', 'Um ou mais assentos não estão disponíveis.'),
        ],
      ),
      example('GET', `/reservations/${held.reservationId}`, 200, held),
      example(
        'POST',
        `/reservations/${held.reservationId}/confirm`,
        200,
        { ...held, status: 'CONFIRMED', confirmedAt: '2026-11-19T15:01:00Z' },
        { orderId: id(6, 3) },
        [error(410, 'RESERVATION_EXPIRED', 'O prazo da reserva terminou.')],
      ),
      example(
        'POST',
        `/reservations/${held.reservationId}/release`,
        200,
        { ...held, status: 'RELEASED' },
        { reason: 'PAYMENT_DECLINED' },
        [error(409, 'INVALID_STATE_TRANSITION', 'Reserva já confirmada.')],
      ),
    ],
  },
  orders: {
    responsibility: 'Pedidos e orquestração da SAGA.',
    fixtures: { orders },
    examples: [
      example('GET', '/orders?username=marina', 200, list(orders)),
      example(
        'POST',
        '/orders',
        202,
        {
          orderId: id(6, 3),
          sagaId: id(6, 3),
          status: 'PENDING',
          sagaStatus: 'RUNNING',
          createdAt: '2026-11-19T15:00:00Z',
        },
        {
          reservationId: held.reservationId,
          username: held.username,
          items: held.items,
          paymentMethod: 'SIMULATED',
        },
        [invalid, reused],
      ),
      example('GET', `/orders/${orders[0].orderId}`, 200, orders[0]),
      example('GET', `/orders/${orders[0].orderId}/timeline`, 200, {
        orderId: orders[0].orderId,
        items: [
          { status: 'PENDING', label: 'Pedido recebido', occurredAt: orders[0].createdAt },
          {
            status: 'CONFIRMED',
            label: 'Ingressos confirmados',
            occurredAt: orders[0].confirmedAt,
          },
        ],
      }),
      example(
        'POST',
        `/orders/${orders[0].orderId}/cancel`,
        202,
        { ...orders[0], status: 'REFUND_PENDING', sagaStatus: 'COMPENSATING' },
        { reason: 'CUSTOMER_REQUEST' },
        [reused, error(409, 'INVALID_STATE_TRANSITION', 'Pedido não confirmado.')],
      ),
    ],
  },
  payments: {
    responsibility: 'Cobrança simulada, idempotência por pedido e estorno.',
    fixtures: {
      payments,
      refunded: {
        ...payments[0],
        status: 'REFUNDED',
        refundId: id(11, 1),
        refundedAt: '2026-11-19T15:01:00Z',
      },
    },
    examples: [
      example(
        'POST',
        '/payments',
        202,
        pendingPayment,
        {
          orderId: id(6, 3),
          reservationId: held.reservationId,
          amountCents: 12000,
          currency: 'BRL',
          method: 'SIMULATED',
        },
        [invalid, reused],
      ),
      example('GET', `/payments/${payments[0].paymentId}`, 200, payments[0]),
      example(
        'POST',
        `/payments/${payments[0].paymentId}/refund`,
        202,
        { paymentId: payments[0].paymentId, status: 'REFUND_PENDING' },
        { reason: 'CUSTOMER_REQUEST' },
        [unavailable],
      ),
    ],
  },
  notifications: {
    responsibility:
      'Confirmações persistidas antes de tentativa de entrega. Criação somente por mensagem.',
    fixtures: {
      notifications,
      failed: {
        ...notifications[0],
        notificationId: id(8, 3),
        status: 'FAILED',
        sentAt: null,
        failureCode: 'DELIVERY_FAILED',
      },
    },
    examples: [
      example('GET', '/notifications', 200, list(notifications)),
      example(
        'GET',
        `/notifications/${notifications[0].notificationId}`,
        200,
        notifications[0],
        null,
        [missing],
      ),
    ],
  },
};

for (const [name, content] of Object.entries(files)) {
  await writeJson(`${name}.json`, { contractVersion: 1, service: name, ...content });
}

const commands = [
  [
    'reservation.hold',
    'reservations',
    {
      reservationId: held.reservationId,
      username: held.username,
      items: held.items,
      expiresInSeconds: 600,
    },
  ],
  ['reservation.confirm', 'reservations', { orderId: id(6, 3), reservationId: held.reservationId }],
  [
    'reservation.release',
    'reservations',
    { orderId: id(6, 3), reservationId: held.reservationId, reason: 'PAYMENT_DECLINED' },
  ],
  [
    'reservation.cancel',
    'reservations',
    { orderId: id(6, 1), reservationId: id(5, 1), reason: 'CUSTOMER_REQUEST' },
  ],
  [
    'payment.charge',
    'payments',
    {
      orderId: id(6, 3),
      reservationId: held.reservationId,
      amountCents: 12000,
      currency: 'BRL',
      method: 'SIMULATED',
    },
  ],
  [
    'payment.refund',
    'payments',
    { orderId: id(6, 1), paymentId: id(7, 1), reason: 'CUSTOMER_REQUEST' },
  ],
  [
    'notification.send',
    'notifications',
    {
      orderId: id(6, 1),
      username: 'marina',
      customerId: null,
      template: 'ORDER_CONFIRMED',
      data: { amountCents: 8000 },
    },
  ],
].map(([messageType, service, payload], index) => ({
  topic: `etiquete.${service}.commands`,
  key: payload.orderId || payload.reservationId,
  value: {
    messageId: id(12, index + 1),
    messageType,
    messageVersion: 1,
    occurredAt: '2026-11-19T15:00:00Z',
    producer: 'orders-service',
    correlationId: id(9, 1),
    causationId: null,
    aggregateType: 'Order',
    aggregateId: payload.orderId || payload.reservationId,
    payload,
  },
}));

const eventExamples = [
  [
    'order.created',
    'orders',
    orders[0].orderId,
    { orderId: orders[0].orderId, username: 'marina', items: sampleItems, amountCents: 8000 },
  ],
  [
    'order.confirmed',
    'orders',
    orders[0].orderId,
    {
      orderId: orders[0].orderId,
      reservationId: id(5, 1),
      paymentId: id(7, 1),
      confirmedAt: orders[0].confirmedAt,
    },
  ],
  [
    'order.cancelled',
    'orders',
    orders[1].orderId,
    { orderId: orders[1].orderId, reason: 'PAYMENT_DECLINED', cancelledAt: '2026-11-17T17:01:00Z' },
  ],
  ['reservation.held', 'reservations', held.reservationId, held],
  ['reservation.confirmed', 'reservations', id(6, 1), reservations[0]],
  ['reservation.expired', 'reservations', reservations[1].reservationId, reservations[1]],
  ['reservation.released', 'reservations', id(6, 2), reservations[2]],
  [
    'reservation.cancelled',
    'reservations',
    id(6, 1),
    {
      ...reservations[0],
      cancelledAt: '2026-11-19T15:01:00Z',
      cancellationReason: 'CUSTOMER_REQUEST',
    },
  ],
  ['payment.succeeded', 'payments', id(6, 1), payments[0]],
  ['payment.failed', 'payments', id(6, 2), payments[1]],
  [
    'payment.refunded',
    'payments',
    id(6, 1),
    { ...payments[0], status: 'REFUNDED', refundId: id(11, 1), refundedAt: '2026-11-19T15:01:00Z' },
  ],
  ['notification.sent', 'notifications', id(6, 1), notifications[0]],
  [
    'notification.failed',
    'notifications',
    id(6, 1),
    { ...notifications[0], status: 'FAILED', sentAt: null, failureCode: 'DELIVERY_FAILED' },
  ],
].map(([messageType, service, aggregateId, payload], index) => ({
  topic: `etiquete.${service}.events`,
  key: aggregateId,
  value: {
    messageId: id(13, index + 1),
    messageType,
    messageVersion: 1,
    occurredAt: '2026-11-19T15:00:00Z',
    producer: `${service}-service`,
    correlationId: id(9, 1),
    causationId:
      commands.find((command) => command.topic === `etiquete.${service}.commands`)?.value
        .messageId || null,
    aggregateType: messageType.startsWith('reservation.') ? 'Reservation' : 'Order',
    aggregateId,
    payload,
  },
}));

await writeJson('messages.json', { commands, events: eventExamples });

await writeJson('scenarios.json', scenarios);

console.log(`Exportadas ${Object.keys(files).length} coleções de serviço, mensagens e cenários.`);
