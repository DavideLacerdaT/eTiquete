import { ApiError, fail } from './contracts.js';

// Mesmo ponto de substituição para Gateway e dependências de qualquer serviço.
// A configuração é do processo; não aceite URLs nem modos vindos de clientes HTTP.
export function createDependencies({ config, mock, fetchImpl = globalThis.fetch, liveCommand }) {
  async function httpRequest(url, method, body, context, service) {
    try {
      const response = await fetchImpl(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-Id': context.correlationId,
          ...(context.idempotencyKey && { 'Idempotency-Key': context.idempotencyKey }),
          ...(context.admissionToken && { 'X-Admission-Token': context.admissionToken }),
        },
        ...(body !== undefined && { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(config.timeoutMs),
      });
      const data = await response.json();
      if (!response.ok)
        throw new ApiError(
          response.status,
          data.error?.code || 'DEPENDENCY_UNAVAILABLE',
          data.error?.message || 'Dependência indisponível.',
          data.error?.details,
        );
      return { status: response.status, body: data };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      fail(503, 'DEPENDENCY_UNAVAILABLE', `Não foi possível comunicar com ${service}.`, {
        service,
      });
    }
  }
  return {
    async request(service, method, path, body, context = {}) {
      const dependency = config.dependencies[service];
      if (!dependency) throw new Error(`Dependência desconhecida: ${service}`);
      if (dependency.mode === 'mock' && !config.mockBaseUrl)
        return mock.request(service, method, path, body, context);
      const base = dependency.mode === 'mock' ? config.mockBaseUrl : dependency.url;
      return httpRequest(`${base}/api/v1${path}`, method, body, context, service);
    },
    async command(service, messageType, payload, context = {}) {
      if (config.dependencies[service].mode === 'mock') {
        if (config.mockBaseUrl)
          return (
            await httpRequest(
              `${config.mockBaseUrl}/_mock/commands`,
              'POST',
              { service, messageType, payload },
              context,
              service,
            )
          ).body;
        return mock.command(service, messageType, payload, context);
      }
      if (!liveCommand)
        fail(503, 'DEPENDENCY_UNAVAILABLE', 'Transporte Kafka não configurado.', { service });
      return liveCommand(service, messageType, payload, context);
    },
  };
}
