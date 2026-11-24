import { ApiError, isUuid, requireValue, uuid } from '../../../shared/contracts.js';
import { API_BASE_PATH, httpOperations, operationPath } from '../../../shared/http-contract.js';

export function newContext(correlationId = uuid()) {
  return { correlationId, idempotencyKey: uuid() };
}

function invalidResponse(correlationId) {
  return new ApiError(
    502,
    'INVALID_GATEWAY_RESPONSE',
    'O serviço retornou uma resposta incompatível.',
    {
      correlationId,
    },
  );
}

// Nenhum retry de escrita é automático. O chamador conserva seu contexto em caso de timeout.
export function createHttpTransport({ fetchImpl = globalThis.fetch, timeoutMs = 10000 } = {}) {
  return async function transport({ method, path, body, context, signal }) {
    const timeout = AbortSignal.timeout(timeoutMs);
    const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;

    try {
      const response = await fetchImpl(`${API_BASE_PATH}${path}`, {
        method,
        signal: requestSignal,
        headers: {
          Accept: 'application/json',
          'X-Correlation-Id': context.correlationId,
          ...(body !== undefined && { 'Content-Type': 'application/json' }),
          ...(context.idempotencyKey && { 'Idempotency-Key': context.idempotencyKey }),
          ...(context.admissionToken && { 'X-Admission-Token': context.admissionToken }),
          ...(context.accessToken && { Authorization: `Bearer ${context.accessToken}` }),
        },
        ...(body !== undefined && { body: JSON.stringify(body) }),
      });

      const correlationId = response.headers.get('X-Correlation-Id') || context.correlationId;
      let data;

      try {
        data = await response.json();
      } catch {
        throw invalidResponse(correlationId);
      }

      if (!response.ok) {
        if (!data?.error?.code || !data.error.message) {
          throw invalidResponse(correlationId);
        }

        throw new ApiError(response.status, data.error.code, data.error.message, {
          ...data.error.details,
          correlationId: data.error.correlationId || correlationId,
        });
      }

      return { status: response.status, body: data, correlationId };
    } catch (error) {
      if (signal?.aborted) {
        throw signal.reason;
      }

      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(
        503,
        'DEPENDENCY_UNAVAILABLE',
        'Não foi possível acessar o Gateway. Tente novamente.',
        {
          correlationId: context.correlationId,
        },
      );
    }
  };
}

export function createMockTransport(network) {
  return async function transport({ method, path, body, context, signal }) {
    signal?.throwIfAborted();

    const result = await network.api(method, path, body, context);

    signal?.throwIfAborted();

    return { ...result, correlationId: context.correlationId };
  };
}

function validateResponse(operation, result) {
  const body = result.body;
  const shape = operation.response;

  if (
    result.status !== operation.status ||
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    throw invalidResponse(result.correlationId);
  }

  if (shape === 'page') {
    const pagination = body.pagination;

    if (
      !Array.isArray(body.items) ||
      !pagination ||
      !['page', 'limit', 'totalItems', 'totalPages'].every((key) =>
        Number.isInteger(pagination[key]),
      ) ||
      pagination.page < 1 ||
      pagination.limit < 1 ||
      pagination.limit > 100 ||
      pagination.totalItems < 0 ||
      pagination.totalPages < 0
    ) {
      throw invalidResponse(result.correlationId);
    }
  } else if (shape === 'items' || shape === 'seats') {
    if (!Array.isArray(body[shape])) {
      throw invalidResponse(result.correlationId);
    }
  } else if (shape && !isUuid(body[shape])) {
    throw invalidResponse(result.correlationId);
  }
}

export function createApiClient(transport) {
  return async function request(name, { params, query, body, context = {}, signal } = {}) {
    const path = operationPath(name, params, query);
    const operation = httpOperations[name];
    const requestContext = { ...context, correlationId: context.correlationId || uuid() };

    if (operation.idempotent) {
      requireValue(
        isUuid(context.idempotencyKey),
        'Mantenha uma chave de idempotência para esta operação.',
      );
    }

    if (operation.admission) {
      requireValue(context.admissionToken, 'Informe o token de admissão da compra.');
    }

    try {
      const result = await transport({
        method: operation.method,
        path,
        body,
        context: requestContext,
        signal,
      });

      validateResponse(operation, result);

      return result.body;
    } catch (error) {
      if (error instanceof ApiError) {
        error.details = { correlationId: requestContext.correlationId, ...error.details };
      }

      throw error;
    }
  };
}
