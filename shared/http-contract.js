import { requireValue } from './contracts.js';

export const API_BASE_PATH = '/api/v1';

// Métodos, destinos e status compartilhados pelo Gateway, cliente React e fixtures.
// "extension" identifica complementos documentados em desenvolvimento.md.
export const httpOperations = {
  listEvents: {
    method: 'GET',
    path: '/events',
    service: 'catalog',
    status: 200,
    query: ['page', 'limit', 'search', 'category'],
    response: 'page',
  },
  getEvent: {
    method: 'GET',
    path: '/events/:eventId',
    service: 'catalog',
    status: 200,
    response: 'eventId',
  },
  listEventSessions: {
    method: 'GET',
    path: '/events/:eventId/sessions',
    service: 'catalog',
    status: 200,
    response: 'items',
  },
  getSession: {
    method: 'GET',
    path: '/sessions/:sessionId',
    service: 'catalog',
    status: 200,
    response: 'sessionId',
  },
  getSessionSeats: {
    method: 'GET',
    path: '/sessions/:sessionId/seats',
    service: 'reservations',
    status: 200,
    response: 'seats',
  },
  createAdmission: {
    method: 'POST',
    path: '/admissions',
    service: 'admissions',
    status: 202,
    response: 'admissionTokenId',
  },
  getAdmission: {
    method: 'GET',
    path: '/admissions/:admissionTokenId',
    service: 'admissions',
    status: 200,
    response: 'admissionTokenId',
  },
  validateAdmission: {
    method: 'POST',
    path: '/admissions/validate',
    service: 'admissions',
    status: 200,
  },
  listReservations: {
    method: 'GET',
    path: '/reservations',
    service: 'reservations',
    status: 200,
    query: ['page', 'limit', 'username'],
    response: 'page',
    extension: true,
  },
  createReservation: {
    method: 'POST',
    path: '/reservations',
    service: 'reservations',
    status: 201,
    idempotent: true,
    admission: true,
    response: 'reservationId',
  },
  getReservation: {
    method: 'GET',
    path: '/reservations/:reservationId',
    service: 'reservations',
    status: 200,
    response: 'reservationId',
  },
  confirmReservation: {
    method: 'POST',
    path: '/reservations/:reservationId/confirm',
    service: 'reservations',
    status: 200,
    response: 'reservationId',
  },
  releaseReservation: {
    method: 'POST',
    path: '/reservations/:reservationId/release',
    service: 'reservations',
    status: 200,
    response: 'reservationId',
  },
  listOrders: {
    method: 'GET',
    path: '/orders',
    service: 'orders',
    status: 200,
    query: ['page', 'limit', 'username'],
    response: 'page',
    extension: true,
  },
  createOrder: {
    method: 'POST',
    path: '/orders',
    service: 'orders',
    status: 202,
    idempotent: true,
    admission: true,
    response: 'orderId',
  },
  getOrder: {
    method: 'GET',
    path: '/orders/:orderId',
    service: 'orders',
    status: 200,
    response: 'orderId',
  },
  getOrderTimeline: {
    method: 'GET',
    path: '/orders/:orderId/timeline',
    service: 'orders',
    status: 200,
    response: 'items',
  },
  cancelOrder: {
    method: 'POST',
    path: '/orders/:orderId/cancel',
    service: 'orders',
    status: 202,
    idempotent: true,
    response: 'orderId',
  },
  createPayment: {
    method: 'POST',
    path: '/payments',
    service: 'payments',
    status: 202,
    idempotent: true,
    response: 'paymentId',
  },
  getPayment: {
    method: 'GET',
    path: '/payments/:paymentId',
    service: 'payments',
    status: 200,
    response: 'paymentId',
  },
  refundPayment: {
    method: 'POST',
    path: '/payments/:paymentId/refund',
    service: 'payments',
    status: 202,
    idempotent: true,
  },
  listNotifications: {
    method: 'GET',
    path: '/notifications',
    service: 'notifications',
    status: 200,
    query: ['page', 'limit', 'username'],
    response: 'page',
  },
  getNotification: {
    method: 'GET',
    path: '/notifications/:notificationId',
    service: 'notifications',
    status: 200,
    response: 'notificationId',
  },
  getGatewayServices: {
    method: 'GET',
    path: '/_dev/services',
    service: 'gateway',
    status: 200,
    extension: true,
  },
};

export function operationPath(name, params = {}, query = {}) {
  const operation = httpOperations[name];

  requireValue(operation, `Operação HTTP desconhecida: ${name}.`);

  const path = operation.path.replace(/:([A-Za-z]+)/g, (_, key) => {
    requireValue(typeof params[key] === 'string' && params[key].length > 0, `Informe ${key}.`);

    return encodeURIComponent(params[key]);
  });

  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    requireValue(operation.query?.includes(key), `Filtro não previsto: ${key}.`);

    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }

  return search.size ? `${path}?${search}` : path;
}

export function matchHttpOperation(method, pathname) {
  return Object.entries(httpOperations).find(([, operation]) => {
    const pattern = operation.path.replace(/:[A-Za-z]+/g, '[^/]+');

    return operation.method === method && new RegExp(`^${pattern}$`).test(pathname);
  });
}
