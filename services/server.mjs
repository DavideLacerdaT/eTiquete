import { readConfig } from '../shared/config.js';
import { createDependencies } from '../shared/dependencies.js';
import { notFound, routeService } from '../shared/contracts.js';
import { createMockNetwork, factories } from '../mocks/network.js';
import { services } from '../mocks/fixtures.js';
import { createHttpServer } from './http.mjs';

const name = process.env.SERVICE_NAME || process.argv[2];
if (!services.includes(name)) throw new Error(`Informe SERVICE_NAME: ${services.join(', ')}.`);
const config = readConfig(process.env);
const mock = createMockNetwork({
  scenario: config.scenario,
  deps: {
    request: (...args) => deps.request(...args),
    command: (...args) => deps.command(...args),
  },
});
let kafka;
const deps = createDependencies({
  config,
  mock,
  liveCommand: (...args) => {
    if (!kafka) throw new Error('Configure MESSAGING_MODE=kafka para comandos reais.');
    return kafka.command(...args);
  },
});
const handler = factories[name]({ deps });
if (process.env.MESSAGING_MODE === 'kafka') {
  const { createKafkaTransport } = await import('./kafka.mjs');
  const commandHandler = {
    command: (type, payload, context) =>
      handler.command?.(type, payload, { scenario: config.scenario, ...context }) ?? notFound(),
  };
  kafka = await createKafkaTransport({
    name,
    handler: commandHandler,
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    timeoutMs: config.timeoutMs,
  });
}
const server = createHttpServer(async ({ method, url, body, context }) => {
  if (url.pathname === '/health')
    return {
      status: 200,
      body: { status: 'ok', service: name, implementation: 'development-simulator' },
    };
  if (!url.pathname.startsWith('/api/v1/')) return notFound();
  if (routeService(url.pathname.slice('/api/v1'.length)) !== name) return notFound();
  return handler.handle(
    method,
    url.pathname.slice('/api/v1/'.length).split('/').filter(Boolean),
    body || {},
    { scenario: config.scenario, ...context },
    url.searchParams,
  );
});
const port = Number(process.env.PORT || 3011 + services.indexOf(name));
server.listen(port, process.env.HOST || '127.0.0.1', () =>
  console.log(`${name}: http://127.0.0.1:${port} (simulador de desenvolvimento)`),
);
process.on('SIGTERM', async () => {
  server.close();
  await kafka?.close();
});
