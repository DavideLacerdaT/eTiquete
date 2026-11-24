import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { createGateway } from '../services/gateway/server.mjs';
import { createHttpServer } from '../services/http.mjs';
import { readConfig } from '../shared/config.js';
import { isUuid, uuid } from '../shared/contracts.js';
import {
  API_BASE_PATH,
  httpOperations,
  matchHttpOperation,
  operationPath,
} from '../shared/http-contract.js';
import { createMockNetwork } from '../mocks/network.js';
import { id, services } from '../mocks/fixtures.js';
import {
  createApiClient,
  createHttpTransport,
  createMockTransport,
  newContext,
} from '../frontend/src/services/http-client.js';
import { createCatalogService } from '../frontend/src/services/catalog.js';
import { createAdmissionsService } from '../frontend/src/services/admissions.js';
import { createReservationsService } from '../frontend/src/services/reservations.js';
import { createOrdersService } from '../frontend/src/services/orders.js';
import { createPaymentsService } from '../frontend/src/services/payments.js';
import { createNotificationsService } from '../frontend/src/services/notifications.js';
import { listAll } from '../frontend/src/services/pagination.js';

async function startGateway() {
  const server = createGateway(readConfig({ DATA_MODE: 'mock' }));

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

for (const mode of ['mock', 'http']) {
  test(`cliente dos seis domínios executa reserva antes do pedido via ${mode}`, async () => {
    const network = createMockNetwork({ delay: 1 });
    const gateway = mode === 'http' ? await startGateway() : null;
    const transport = gateway
      ? createHttpTransport({
          fetchImpl: (path, options) => fetch(`${gateway.base}${path}`, options),
        })
      : createMockTransport(network);

    const request = createApiClient(transport);
    const catalog = createCatalogService(request);
    const admissions = createAdmissionsService(request);
    const reservations = createReservationsService(request);
    const orders = createOrdersService(request);
    const payments = createPaymentsService(request);
    const notifications = createNotificationsService(request);
    const context = newContext();

    try {
      const events = await catalog.list({ search: 'Jazz', page: 1, limit: 20 });
      const event = await catalog.get(events.items[0].eventId);
      const sessions = await catalog.sessions(event.eventId);
      const session = await catalog.session(sessions.items[0].sessionId);
      const inventory = await catalog.seats(session.sessionId);
      const seat = inventory.seats.find((item) => item.status === 'AVAILABLE');

      const admission = await admissions.create(
        { eventId: event.eventId, sessionId: session.sessionId },
        { context },
      );
      const admissionStatus = await admissions.get(admission.admissionTokenId);

      assert.equal(admissionStatus.status, 'ADMITTED');

      const reserveContext = {
        ...newContext(context.correlationId),
        admissionToken: admission.token,
      };
      const reservationBody = {
        username: 'marina',
        items: [{ sessionId: session.sessionId, seatIds: [seat.seatId] }],
        expiresInSeconds: 600,
      };

      const reservation = await reservations.create(reservationBody, { context: reserveContext });
      const replay = await reservations.create(reservationBody, { context: reserveContext });

      assert.deepEqual(replay, reservation);
      assert.equal(reservation.status, 'HELD');
      assert.equal(
        (await reservations.get(reservation.reservationId)).reservationId,
        reservation.reservationId,
      );

      const orderContext = {
        ...newContext(context.correlationId),
        admissionToken: admission.token,
      };
      const orderBody = {
        reservationId: reservation.reservationId,
        username: reservation.username,
        items: reservation.items,
        paymentMethod: 'SIMULATED',
      };

      const order = await orders.create(orderBody, { context: orderContext });
      const repeated = await orders.create(orderBody, { context: orderContext });

      assert.equal(repeated.orderId, order.orderId);

      let current;

      for (let attempt = 0; attempt < 80; attempt += 1) {
        current = await orders.get(order.orderId);

        if (current.status === 'CONFIRMED') {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      assert.equal(current.status, 'CONFIRMED');
      assert.equal(current.sagaId, order.orderId);
      assert.ok((await orders.timeline(order.orderId)).items.length > 0);
      assert.equal((await payments.get(current.paymentId)).status, 'SUCCEEDED');

      const messages = await notifications.list({ username: 'marina' });
      const notification = messages.items.find((item) => item.orderId === order.orderId);

      assert.ok(notification);
      assert.equal((await notifications.get(notification.notificationId)).orderId, order.orderId);
      assert.ok(
        (await orders.list({ username: 'marina' })).items.some(
          (item) => item.orderId === order.orderId,
        ),
      );

      const cancellation = await orders.cancel(order.orderId, {
        context: newContext(context.correlationId),
      });

      assert.equal(cancellation.status, 'REFUND_PENDING');
    } finally {
      await network.settled();

      if (gateway) {
        await new Promise((resolve) => gateway.server.close(resolve));
      }
    }
  });
}

test('cliente conserva correlação, admissão e idempotência após timeout; não repete sozinho', async () => {
  const calls = [];
  const context = {
    ...newContext(),
    admissionToken: 'temporary-token',
    accessToken: 'identity-token',
  };
  const body = { username: 'marina', items: [], expiresInSeconds: 600 };
  const request = createApiClient(
    createHttpTransport({
      fetchImpl: async (path, options) => {
        calls.push({ path, options });

        if (calls.length === 1) {
          throw new TypeError('Network error');
        }

        return Response.json({ reservationId: uuid() }, { status: 201 });
      },
    }),
  );

  const reservations = createReservationsService(request);

  await assert.rejects(reservations.create(body, { context }), (error) => {
    assert.equal(error.code, 'DEPENDENCY_UNAVAILABLE');
    assert.equal(error.details.correlationId, context.correlationId);
    return true;
  });

  assert.equal(calls.length, 1);

  await reservations.create(body, { context });

  assert.equal(calls[0].path, '/api/v1/reservations');
  assert.deepEqual(calls[0].options.headers, calls[1].options.headers);
  assert.equal(calls[1].options.headers['X-Correlation-Id'], context.correlationId);
  assert.equal(calls[1].options.headers['Idempotency-Key'], context.idempotencyKey);
  assert.equal(calls[1].options.headers['X-Admission-Token'], context.admissionToken);
  assert.equal(calls[1].options.headers.Authorization, 'Bearer identity-token');
  assert.equal(calls[0].options.body, calls[1].options.body);
});

test('cliente preserva erros contratuais e rejeita HTML, status e envelopes incompatíveis', async () => {
  const correlationId = uuid();
  const requestWith = (response) =>
    createApiClient(createHttpTransport({ fetchImpl: async () => response }));

  const conflict = requestWith(
    Response.json(
      {
        error: {
          code: 'SEAT_UNAVAILABLE',
          message: 'Lugar indisponível.',
          details: { seatId: id(4, 1) },
          correlationId,
        },
      },
      { status: 409 },
    ),
  );

  await assert.rejects(
    conflict('getSessionSeats', { params: { sessionId: id(2, 1) } }),
    (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.code, 'SEAT_UNAVAILABLE');
      assert.equal(error.details.correlationId, correlationId);
      assert.equal(error.details.seatId, id(4, 1));
      return true;
    },
  );

  for (const response of [
    new Response('<html>SPA</html>'),
    Response.json({ items: [] }),
    Response.json({ items: [] }, { status: 202 }),
  ]) {
    await assert.rejects(requestWith(response)('listEvents'), {
      code: 'INVALID_GATEWAY_RESPONSE',
      status: 502,
    });
  }

  const controller = new AbortController();
  controller.abort();

  const cancelled = createApiClient(createMockTransport(createMockNetwork()));

  await assert.rejects(cancelled('listEvents', { signal: controller.signal }), {
    name: 'AbortError',
  });
});

test('filtros são codificados e paginação completa não perde registros após os primeiros 100', async () => {
  const username = 'ana & joão';
  const path = operationPath('listOrders', {}, { username, page: 2, limit: 100 });

  assert.equal(new URL(path, 'http://gateway').searchParams.get('username'), username);
  assert.throws(() => operationPath('listOrders', {}, { destination: 'http://another-service' }), {
    code: 'VALIDATION_ERROR',
  });

  const data = await listAll(async ({ page, limit }) => ({
    items: page === 1 ? Array.from({ length: limit }, (_, index) => index) : [100],
    pagination: { page, limit, totalItems: 101, totalPages: 2 },
  }));

  assert.equal(data.length, 101);
  assert.equal(data.at(-1), 100);
});

test('Gateway encaminha contexto HTTP ao domínio live sem tratar o token como autenticação implementada', async () => {
  let received;
  const domain = createHttpServer(async ({ context, url }) => {
    received = { context, path: url.pathname };
    return {
      status: 200,
      body: { items: [], pagination: { page: 1, limit: 20, totalItems: 0, totalPages: 0 } },
    };
  });

  domain.listen(0, '127.0.0.1');
  await once(domain, 'listening');

  const gateway = createGateway(
    readConfig({
      DATA_MODE: 'mock',
      CATALOG_MODE: 'live',
      CATALOG_URL: `http://127.0.0.1:${domain.address().port}`,
    }),
  );

  gateway.listen(0, '127.0.0.1');
  await once(gateway, 'listening');

  const context = { ...newContext(), accessToken: 'development-example' };

  try {
    const request = createApiClient(
      createHttpTransport({
        fetchImpl: (path, options) =>
          fetch(`http://127.0.0.1:${gateway.address().port}${path}`, options),
      }),
    );

    await request('listEvents', { context });

    assert.equal(received.path, '/api/v1/events');
    assert.equal(received.context.correlationId, context.correlationId);
    assert.equal(received.context.authorization, 'Bearer development-example');
  } finally {
    await new Promise((resolve) => gateway.close(resolve));
    await new Promise((resolve) => domain.close(resolve));
  }
});

test('registro HTTP cobre todas as fixtures e rejeita caminhos e métodos fora do contrato', async () => {
  const covered = new Set();

  for (const service of ['gateway', ...services]) {
    const fixture = JSON.parse(
      await readFile(new URL(`../mocks/contracts/${service}.json`, import.meta.url), 'utf8'),
    );

    for (const example of fixture.examples) {
      const path = new URL(example.request.path, 'http://gateway').pathname.slice(
        API_BASE_PATH.length,
      );
      const match = matchHttpOperation(example.request.method, path);

      assert.ok(match, `${example.request.method} ${path} está ausente no registro.`);
      assert.equal(match[1].status, example.response.status);
      covered.add(match[0]);
    }
  }

  assert.deepEqual([...covered].sort(), Object.keys(httpOperations).sort());
  assert.equal(matchHttpOperation('GET', `/sessions/${id(2, 1)}/seats`)[1].service, 'reservations');

  const { server, base } = await startGateway();

  try {
    for (const [method, path] of [
      ['GET', '/notifications/unexpected/extra'],
      ['DELETE', '/events'],
      ['POST', '/_dev/services'],
    ]) {
      const response = await fetch(`${base}/api/v1${path}`, { method });
      const body = await response.json();

      assert.equal(response.status, 404);
      assert.equal(body.error.code, 'RESOURCE_NOT_FOUND');
      assert.ok(isUuid(body.error.correlationId));
      assert.equal(response.headers.get('X-Correlation-Id'), body.error.correlationId);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
