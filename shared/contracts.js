export class ApiError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);

    Object.assign(this, { status, code, details });
  }
}

export const uuid = () => globalThis.crypto.randomUUID();

export function fail(status, code, message, details) {
  throw new ApiError(status, code, message, details);
}

export function requireValue(condition, message = 'Revise os campos informados.') {
  if (!condition) {
    fail(400, 'VALIDATION_ERROR', message);
  }
}

export const isUuid = (value) =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function validateItems(items) {
  requireValue(Array.isArray(items) && items.length > 0, 'Informe os ingressos.');

  const keys = [];

  for (const item of items) {
    requireValue(
      isUuid(item.sessionId) && Array.isArray(item.seatIds) && item.seatIds.length > 0,
      'Sessão e assentos são obrigatórios.',
    );

    for (const seatId of item.seatIds) {
      requireValue(isUuid(seatId), 'Assento inválido.');

      keys.push(`${item.sessionId}:${seatId}`);
    }
  }

  requireValue(keys.length <= 2, 'Cada compra permite até 2 ingressos.');

  requireValue(new Set(keys).size === keys.length, 'Não repita o mesmo assento.');

  return keys;
}

export function canonical(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

export function paginate(items, query) {
  const page = Number(query.get('page') || 1);

  const limit = Number(query.get('limit') || 20);

  requireValue(
    Number.isInteger(page) && page >= 1 && Number.isInteger(limit) && limit >= 1 && limit <= 100,
    'Paginação inválida.',
  );

  return {
    items: items.slice((page - 1) * limit, page * limit),
    pagination: {
      page,
      limit,
      totalItems: items.length,
      totalPages: Math.ceil(items.length / limit),
    },
  };
}

export const notFound = () => fail(404, 'RESOURCE_NOT_FOUND', 'Recurso não encontrado.');

export function envelope(messageType, producer, aggregateId, payload, context = {}) {
  return {
    messageId: uuid(),
    messageType,
    messageVersion: 1,
    occurredAt: new Date().toISOString(),
    producer,
    correlationId: context.correlationId || uuid(),
    causationId: context.messageId || null,
    aggregateType: messageType.split('.')[0].replace(/^./, (c) => c.toUpperCase()),
    aggregateId,
    payload,
  };
}

export function routeService(path) {
  const route = path.split('?')[0];

  if (/^\/sessions\/[^/]+\/seats$/.test(route)) {
    return 'reservations';
  }

  if (/^\/(events|sessions)(\/|$)/.test(route)) {
    return 'catalog';
  }

  return ['admissions', 'reservations', 'orders', 'payments', 'notifications'].find(
    (name) => route === `/${name}` || route.startsWith(`/${name}/`),
  );
}

export const errorBody = (error, correlationId) => ({
  error: {
    code: error.code || 'INTERNAL_ERROR',
    message: error.code ? error.message : 'Falha inesperada no serviço.',
    details: error.details || {},
    correlationId,
  },
});
