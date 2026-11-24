export const paths = {
  home: '/',
  events: '/eventos',
  event: (eventId) => `/eventos/${encodeURIComponent(eventId)}`,
  checkout: (eventId) => `/eventos/${encodeURIComponent(eventId)}/checkout`,
  tickets: '/ingressos',
  order: (orderId) => `/pedidos/${encodeURIComponent(orderId)}`,
  notifications: '/notificacoes',
  lab: '/laboratorio',
};

export const routePatterns = {
  event: '/eventos/:eventId',
  checkout: '/eventos/:eventId/checkout',
  order: '/pedidos/:orderId',
};

export function legacyDestination(hash) {
  const destination = paths[hash.replace(/^#/, '')];

  return typeof destination === 'string' ? destination : undefined;
}
