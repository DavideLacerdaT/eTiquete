import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockNetwork } from '../mocks/network.js';
import { id, seats, services, scenarios } from '../mocks/fixtures.js';
import { uuid } from '../shared/contracts.js';
import { readConfig } from '../shared/config.js';
import { createDependencies } from '../shared/dependencies.js';
import { createGateway } from '../services/gateway/server.mjs';
import { createHttpServer } from '../services/http.mjs';
import { createCatalog } from '../mocks/services/catalog.js';
import { createOrders } from '../mocks/services/orders.js';
import { createPayments } from '../mocks/services/payments.js';
import { readFile } from 'node:fs/promises';

const ctx = (overrides) => ({ correlationId: uuid(), idempotencyKey: uuid(), ...overrides });
const item = (number = 1, session = 1) => ({
  sessionId: id(2, session),
  seatIds: [id(4, (session - 1) * 100 + number)],
});
async function admitted(net) {
  return (await net.api('POST', '/admissions', { eventId: id(1, 1), sessionId: id(2, 1) })).body
    .token;
}
async function reserve(net, options = {}) {
  const context = ctx({ admissionToken: await admitted(net) });
  const body = { username: 'marina', items: [item()], ...options };
  const result = await net.api('POST', '/reservations', body, context);
  return { reservation: result.body, context, body };
}
async function purchase(net) {
  const { reservation, context } = await reserve(net);
  const body = {
    reservationId: reservation.reservationId,
    username: reservation.username,
    items: reservation.items,
    paymentMethod: 'SIMULATED',
  };
  const response = await net.api(
    'POST',
    '/orders',
    body,
    ctx({ admissionToken: context.admissionToken }),
  );
  assert.equal(response.status, 202);
  assert.equal(response.body.status, 'PENDING');
  await net.settled();
  return (await net.api('GET', `/orders/${response.body.orderId}`)).body;
}
const errorCode = (code) => (error) => error.code === code;

test('catálogo, filtros, paginação, sessões e assentos usam UUID e centavos', async () => {
  const net = createMockNetwork();
  const list = (await net.api('GET', '/events?limit=2')).body;
  assert.equal(list.items.length, 2);
  assert.equal(list.pagination.totalItems, 4);
  assert.equal((await net.api('GET', '/events?search=jazz')).body.items.length, 1);
  assert.equal((await net.api('GET', `/events/${id(1, 1)}/sessions`)).body.items.length, 2);
  assert.equal((await net.api('GET', `/sessions/${id(2, 1)}/seats`)).body.seats.length, 48);
  await assert.rejects(net.api('GET', '/events?limit=0'), errorCode('VALIDATION_ERROR'));
  await assert.rejects(net.api('GET', `/events/${uuid()}`), errorCode('RESOURCE_NOT_FOUND'));
  assert.ok(seats.every((s) => Number.isInteger(s.priceCents)));
});

test('admissão WAITING evolui por tempo e token expira', async () => {
  let clock = Date.now();
  const net = createMockNetwork({ now: () => clock, scenario: 'queue' });
  const first = (await net.api('POST', '/admissions', { eventId: id(1, 1), sessionId: id(2, 1) }))
    .body;
  assert.equal(first.status, 'WAITING');
  clock += 9000;
  const next = (await net.api('GET', `/admissions/${first.admissionTokenId}`)).body;
  assert.equal(next.status, 'ADMITTED');
  assert.equal(
    (await net.api('POST', '/admissions/validate', { token: next.token })).body.valid,
    true,
  );
  clock += 601000;
  await assert.rejects(
    net.api('POST', '/admissions/validate', { token: next.token }),
    errorCode('ADMISSION_REQUIRED'),
  );
});

test('reserva valida admissão, usuário, duplicatas e limite total entre sessões', async () => {
  const net = createMockNetwork(),
    context = ctx({ admissionToken: await admitted(net) });
  for (const body of [
    { username: '', items: [item()] },
    { username: 'marina', items: [item(), item()] },
    { username: 'marina', items: [item(), item(2), item(3, 2)] },
  ]) {
    await assert.rejects(
      net.api('POST', '/reservations', body, { ...context, idempotencyKey: uuid() }),
      errorCode('VALIDATION_ERROR'),
    );
  }
  await assert.rejects(
    net.api('POST', '/reservations', { username: 'marina', items: [item()] }, ctx()),
    errorCode('ADMISSION_REQUIRED'),
  );
  const result = await net.api(
    'POST',
    '/reservations',
    { username: 'marina', items: [item(), item(1, 2)] },
    context,
  );
  assert.equal(result.body.items.length, 2);
  assert.equal(result.body.amountCents, 24000);
});

test('reserva é atômica e concorrência produz um vencedor', async () => {
  const net = createMockNetwork(),
    token = await admitted(net);
  await assert.rejects(
    net.api(
      'POST',
      '/reservations',
      { username: 'marina', items: [{ sessionId: id(2, 1), seatIds: [id(4, 1), id(4, 4)] }] },
      ctx({ admissionToken: token }),
    ),
    errorCode('SEAT_UNAVAILABLE'),
  );
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, () =>
      net.api(
        'POST',
        '/reservations',
        { username: 'marina', items: [item()] },
        ctx({ admissionToken: token }),
      ),
    ),
  );
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.ok(
    results
      .filter((r) => r.status === 'rejected')
      .every((r) => r.reason.code === 'SEAT_UNAVAILABLE'),
  );
});

test('idempotência de reserva reproduz status/corpo e rejeita outra carga', async () => {
  const net = createMockNetwork(),
    { reservation, context, body } = await reserve(net);
  const duplicate = await net.api('POST', '/reservations', body, context);
  assert.equal(duplicate.status, 201);
  assert.deepEqual(duplicate.body, reservation);
  await assert.rejects(
    net.api('POST', '/reservations', { ...body, username: 'outra' }, context),
    errorCode('IDEMPOTENCY_KEY_REUSED'),
  );
});

test('expiração libera assento e impede confirmação; confirmação terminal não expira', async () => {
  let clock = Date.now();
  const net = createMockNetwork({ now: () => clock });
  const { reservation } = await reserve(net, { expiresInSeconds: 1 });
  clock += 1100;
  assert.equal(
    (await net.api('GET', `/reservations/${reservation.reservationId}`)).body.status,
    'EXPIRED',
  );
  await assert.rejects(
    net.api('POST', `/reservations/${reservation.reservationId}/confirm`, {}),
    errorCode('RESERVATION_EXPIRED'),
  );
  assert.equal(
    (await net.api('GET', `/sessions/${id(2, 1)}/seats`)).body.seats[0].status,
    'AVAILABLE',
  );
  const second = await reserve(net);
  await net.api('POST', `/reservations/${second.reservation.reservationId}/confirm`, {});
  clock += 900000;
  assert.equal(
    (await net.api('GET', `/reservations/${second.reservation.reservationId}`)).body.status,
    'CONFIRMED',
  );
  await assert.rejects(
    net.api('POST', `/reservations/${second.reservation.reservationId}/release`, {}),
    errorCode('INVALID_STATE_TRANSITION'),
  );
});

test('SAGA aprovada confirma reserva, pagamento, pedido e notificação', async () => {
  const net = createMockNetwork({ delay: 1 });
  const order = await purchase(net);
  assert.equal(order.status, 'CONFIRMED');
  assert.equal(order.sagaStatus, 'COMPLETED');
  assert.equal(order.sagaId, order.orderId);
  assert.equal(
    (await net.api('GET', `/reservations/${order.reservationId}`)).body.status,
    'CONFIRMED',
  );
  assert.equal((await net.api('GET', `/payments/${order.paymentId}`)).body.status, 'SUCCEEDED');
  assert.ok(
    (await net.api('GET', '/notifications')).body.items.some((n) => n.orderId === order.orderId),
  );
  assert.ok(
    net.messages.every((m) => m.messageVersion === 1 && m.correlationId && m.key === m.aggregateId),
  );
});

test('pagamento recusado compensa reserva sem confirmar compra', async () => {
  const net = createMockNetwork({ delay: 1, scenario: 'payment-declined' });
  const order = await purchase(net);
  assert.equal(order.status, 'CANCELLED');
  assert.equal(order.sagaStatus, 'COMPENSATED');
  assert.equal(
    (await net.api('GET', `/reservations/${order.reservationId}`)).body.status,
    'RELEASED',
  );
});

test('pagamento tardio produz estorno, nunca confirmação', async () => {
  const net = createMockNetwork({ delay: 1, scenario: 'late-payment' });
  const order = await purchase(net);
  assert.equal(order.status, 'CANCELLED');
  assert.equal(order.sagaStatus, 'COMPENSATED');
  assert.equal((await net.api('GET', `/payments/${order.paymentId}`)).body.status, 'REFUNDED');
  assert.ok(
    !(await net.api('GET', `/orders/${order.orderId}/timeline`)).body.items.some(
      (i) => i.status === 'CONFIRMED',
    ),
  );
});

test('cancelamento só termina após estorno e marca ingresso sem revenda', async () => {
  const net = createMockNetwork({ delay: 1 });
  const order = await purchase(net),
    context = ctx();
  const cancel = () =>
    net.api('POST', `/orders/${order.orderId}/cancel`, { reason: 'CUSTOMER_REQUEST' }, context);
  const first = await cancel();
  assert.equal(first.status, 202);
  assert.equal(first.body.status, 'REFUND_PENDING');
  await net.settled();
  assert.deepEqual(await cancel(), first);
  assert.equal((await net.api('GET', `/orders/${order.orderId}`)).body.status, 'CANCELLED');
  const reservation = (await net.api('GET', `/reservations/${order.reservationId}`)).body;
  assert.equal(reservation.status, 'CONFIRMED');
  assert.ok(reservation.cancelledAt);
  assert.equal((await net.api('GET', `/sessions/${id(2, 1)}/seats`)).body.seats[0].status, 'SOLD');
});

test('falha de estorno fica pendente; falha de notificação não desfaz compra', async () => {
  const net = createMockNetwork({ delay: 1, scenario: 'refund-failed' });
  const order = await purchase(net);
  await net.api('POST', `/orders/${order.orderId}/cancel`, { reason: 'CUSTOMER_REQUEST' }, ctx());
  await net.settled();
  const pending = (await net.api('GET', `/orders/${order.orderId}`)).body;
  assert.equal(pending.status, 'REFUND_PENDING');
  assert.equal(pending.sagaStatus, 'MANUAL_INTERVENTION');
  const other = createMockNetwork({ delay: 1, scenario: 'notification-failed' }),
    confirmed = await purchase(other);
  assert.equal(confirmed.status, 'CONFIRMED');
  assert.equal(
    (await other.api('GET', '/notifications')).body.items.find(
      (n) => n.orderId === confirmed.orderId,
    ).status,
    'FAILED',
  );
});

test('pedido duplicado não duplica cobrança, nem aceita outra compra da mesma reserva', async () => {
  const net = createMockNetwork({ delay: 5 }),
    { reservation, context } = await reserve(net);
  const body = {
    reservationId: reservation.reservationId,
    username: 'marina',
    items: reservation.items,
    paymentMethod: 'SIMULATED',
  };
  const orderContext = ctx({ admissionToken: context.admissionToken });
  const duplicates = await Promise.all([
    net.api('POST', '/orders', body, orderContext),
    net.api('POST', '/orders', body, orderContext),
  ]);
  assert.deepEqual(duplicates[0], duplicates[1]);
  await assert.rejects(
    net.api('POST', '/orders', body, ctx({ admissionToken: context.admissionToken })),
    errorCode('INVALID_STATE_TRANSITION'),
  );
  await net.settled();
  assert.equal(net.messages.filter((m) => m.messageType === 'payment.charge').length, 1);
});

test('modo live propaga headers, não retorna mocks quando HTTP falha', async () => {
  const config = readConfig({ DATA_MODE: 'live', CATALOG_MODE: 'mock' });
  const mock = createMockNetwork();
  let received;
  const deps = createDependencies({
    config,
    mock,
    fetchImpl: async (...args) => {
      received = args;
      throw new Error('offline');
    },
  });
  assert.equal((await deps.request('catalog', 'GET', '/events')).body.items.length, 4);
  const context = ctx({ admissionToken: 'token' });
  await assert.rejects(
    deps.request('orders', 'POST', '/orders', {}, context),
    errorCode('DEPENDENCY_UNAVAILABLE'),
  );
  assert.equal(received[1].headers['X-Correlation-Id'], context.correlationId);
  assert.equal(received[1].headers['Idempotency-Key'], context.idempotencyKey);
  await assert.rejects(
    deps.command('payments', 'payment.charge', {}, context),
    errorCode('DEPENDENCY_UNAVAILABLE'),
  );
  assert.throws(() => readConfig({ ORDERS_MODE: 'automatic' }));
});

test('todas as dependências alternam independentemente HTTP e comandos', async () => {
  for (const name of services) {
    const config = readConfig({ [`${name.toUpperCase()}_MODE`]: 'live' });
    let called = 0;
    const deps = createDependencies({
      config,
      mock: { request: async () => ({ body: 'mock' }), command: async () => 'mock' },
      fetchImpl: async () => {
        called++;
        return { ok: true, status: 200, json: async () => ({ source: name }) };
      },
      liveCommand: async () => `live:${name}`,
    });
    assert.equal((await deps.request(name, 'GET', '/resource')).body.source, name);
    assert.equal(called, 1);
    assert.equal(await deps.command(name, 'command', {}), `live:${name}`);
    const another = services.find((s) => s !== name);
    assert.equal((await deps.request(another, 'GET', '/resource')).body, 'mock');
  }
});

async function listen(server, t) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  );
  return `http://127.0.0.1:${server.address().port}`;
}

test('Gateway HTTP usa envelope, correlação e JSON inválido resulta em 400', async (t) => {
  const url = await listen(createGateway(readConfig()), t);
  const response = await fetch(`${url}/api/v1/events`),
    catalog = await response.json();
  assert.equal(catalog.items.length, 4);
  assert.ok(response.headers.get('x-correlation-id'));
  const invalid = await fetch(`${url}/api/v1/reservations`, { method: 'POST', body: '{' });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error.code, 'VALIDATION_ERROR');
  const missing = await fetch(`${url}/api/v1/unknown`);
  assert.equal(missing.status, 404);
});

test('integração híbrida: admissão mock consulta catálogo HTTP real', async (t) => {
  let calls = 0;
  const catalog = createCatalog();
  const serviceUrl = await listen(
    createHttpServer(({ method, url, body, context }) => {
      calls++;
      return catalog.handle(
        method,
        url.pathname.slice(8).split('/').filter(Boolean),
        body,
        context,
        url.searchParams,
      );
    }),
    t,
  );
  const url = await listen(
    createGateway(readConfig({ CATALOG_MODE: 'live', CATALOG_URL: serviceUrl })),
    t,
  );
  const response = await fetch(`${url}/api/v1/admissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId: id(1, 1), sessionId: id(2, 1) }),
  });
  assert.equal(response.status, 202);
  assert.equal((await response.json()).status, 'ADMITTED');
  assert.equal(calls, 1);
});

test('cenários estáticos de catálogo vazio e indisponibilidade são explícitos', async () => {
  const net = createMockNetwork({ scenario: 'empty' });
  assert.equal((await net.api('GET', '/events')).body.pagination.totalItems, 0);
  net.setScenario('unavailable');
  await assert.rejects(net.api('GET', '/events'), errorCode('DEPENDENCY_UNAVAILABLE'));
  assert.equal(new Set(scenarios.map((s) => s.id)).size, scenarios.length);
});

test('processo de Pedidos com dependências mock HTTP compartilha a mesma compra via hub', async (t) => {
  const hubConfig = readConfig({ ORDERS_MODE: 'live' });
  const hubUrl = await listen(createGateway(hubConfig, { allowMockCommands: true }), t);
  const deps = createDependencies({
    config: readConfig({ MOCK_BASE_URL: hubUrl }),
    mock: createMockNetwork(),
  });
  const domain = createOrders({ deps, delay: 1 });
  const orderUrl = await listen(
    createHttpServer(({ method, url, body, context }) =>
      domain.handle(
        method,
        url.pathname.slice(8).split('/').filter(Boolean),
        body || {},
        context,
        url.searchParams,
      ),
    ),
    t,
  );
  hubConfig.dependencies.orders.url = orderUrl;
  const gatewayUrl = await listen(
    createGateway(readConfig({ MOCK_BASE_URL: hubUrl, ORDERS_MODE: 'live', ORDERS_URL: orderUrl })),
    t,
  );
  async function request(method, path, body, extra = {}) {
    const response = await fetch(`${gatewayUrl}/api/v1${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...extra },
      ...(body && { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  }
  const admission = await request('POST', '/admissions', {
    eventId: id(1, 1),
    sessionId: id(2, 1),
  });
  const headers = {
    'Idempotency-Key': uuid(),
    'X-Admission-Token': admission.body.token,
    'X-Correlation-Id': uuid(),
  };
  const reservation = await request(
    'POST',
    '/reservations',
    { username: 'marina', items: [item()] },
    headers,
  );
  assert.equal(reservation.status, 201);
  const accepted = await request(
    'POST',
    '/orders',
    {
      username: 'marina',
      reservationId: reservation.body.reservationId,
      items: [item()],
      paymentMethod: 'SIMULATED',
    },
    { ...headers, 'Idempotency-Key': uuid() },
  );
  assert.equal(accepted.status, 202);
  await domain.settled();
  const order = await request('GET', `/orders/${accepted.body.orderId}`);
  assert.equal(order.body.status, 'CONFIRMED');
  const payment = await request('GET', `/payments/${order.body.paymentId}`);
  assert.equal(payment.body.status, 'SUCCEEDED');
  const notices = await request('GET', '/notifications');
  assert.ok(notices.body.items.some((n) => n.orderId === order.body.orderId));
  assert.equal(
    (await fetch(`${gatewayUrl}/_mock/commands`, { method: 'POST', body: '{}' })).status,
    404,
  );
});

test('pagamento HTTP deduplica por chave de negócio e estorno também é idempotente', async () => {
  const domain = createPayments({ delay: 1 });
  const body = {
      orderId: uuid(),
      reservationId: uuid(),
      amountCents: 12000,
      currency: 'BRL',
      method: 'SIMULATED',
    },
    context = ctx();
  const first = await domain.handle('POST', ['payments'], body, context);
  assert.equal(first.status, 202);
  assert.deepEqual(await domain.handle('POST', ['payments'], body, context), first);
  const anotherKey = await domain.handle('POST', ['payments'], body, ctx());
  assert.equal(anotherKey.body.paymentId, first.body.paymentId);
  await assert.rejects(
    domain.handle('POST', ['payments'], { ...body, amountCents: 1000 }, ctx()),
    errorCode('IDEMPOTENCY_KEY_REUSED'),
  );
  await domain.settled();
  const refunds = await Promise.all([
    domain.command('payment.refund', { paymentId: first.body.paymentId }, ctx()),
    domain.command('payment.refund', { paymentId: first.body.paymentId }, ctx()),
  ]);
  assert.equal(refunds[0].refundId, refunds[1].refundId);
});

test('comandos duplicados de reserva e notificação não repetem efeitos', async () => {
  const net = createMockNetwork();
  const body = {
    reservationId: uuid(),
    username: 'marina',
    items: [item()],
    expiresInSeconds: 600,
  };
  const first = await net.command('reservations', 'reservation.hold', body, ctx());
  assert.equal(first.reservationId, body.reservationId);
  assert.deepEqual(await net.command('reservations', 'reservation.hold', body, ctx()), first);
  const notification = {
    orderId: uuid(),
    username: 'marina',
    template: 'ORDER_CONFIRMED',
    data: {},
  };
  const notifications = await Promise.all([
    net.command('notifications', 'notification.send', notification, ctx()),
    net.command('notifications', 'notification.send', notification, ctx()),
  ]);
  assert.equal(notifications[0].notificationId, notifications[1].notificationId);
});

test('coleções estáticas cobrem os sete serviços com exemplos HTTP e IDs estáveis', async () => {
  for (const service of ['gateway', ...services]) {
    const fixture = JSON.parse(
      await readFile(new URL(`../mocks/contracts/${service}.json`, import.meta.url), 'utf8'),
    );
    assert.equal(fixture.service, service);
    assert.equal(fixture.contractVersion, 1);
    assert.ok(fixture.examples.length);
    for (const example of fixture.examples) {
      assert.ok(example.request.path.startsWith('/api/v1'));
      assert.ok(example.response.status >= 200 && example.response.status < 300);
    }
  }
});
