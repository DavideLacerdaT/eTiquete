import http from 'node:http';
import { errorBody, fail, isUuid, uuid } from '../shared/contracts.js';

export function createHttpServer(handler) {
  return http.createServer(async (request, response) => {
    const correlationId = isUuid(request.headers['x-correlation-id'])
      ? request.headers['x-correlation-id']
      : uuid();

    response.setHeader('X-Correlation-Id', correlationId);

    response.setHeader('Content-Type', 'application/json; charset=utf-8');

    response.setHeader('Cache-Control', 'no-store');

    try {
      let raw = '';

      let size = 0;

      for await (const chunk of request) {
        size += chunk.length;

        if (size > 65536) {
          fail(413, 'VALIDATION_ERROR', 'Corpo excede 64 KB.');
        }

        raw += chunk;
      }

      let body;

      try {
        body = raw ? JSON.parse(raw) : undefined;
      } catch {
        fail(400, 'VALIDATION_ERROR', 'JSON inválido.');
      }

      if (body !== undefined && (!body || Array.isArray(body) || typeof body !== 'object')) {
        fail(400, 'VALIDATION_ERROR', 'Envie um objeto JSON.');
      }

      const context = {
        correlationId,
        idempotencyKey: request.headers['idempotency-key'],
        admissionToken: request.headers['x-admission-token'],
        authorization: request.headers.authorization,
      };

      const result = await handler({
        method: request.method,
        url: new URL(request.url, 'http://localhost'),
        body,
        context,
      });

      response.writeHead(result.status);

      response.end(JSON.stringify(result.body));
    } catch (error) {
      response.writeHead(error.status || 500);

      response.end(JSON.stringify(errorBody(error, correlationId)));
    }
  });
}
