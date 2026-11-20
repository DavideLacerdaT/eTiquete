import { pathToFileURL } from 'node:url';
import { createHttpServer } from '../http.mjs';
import { readConfig } from '../../shared/config.js';
import { createDependencies } from '../../shared/dependencies.js';
import { notFound, routeService } from '../../shared/contracts.js';
import { createMockNetwork } from '../../mocks/network.js';

export function createGateway(config = readConfig(process.env), options = {}) {
  let deps;
  const mock = createMockNetwork({
    scenario: config.scenario,
    deps: {
      request: (...args) => deps.request(...args),
      command: (...args) => deps.command(...args),
    },
  });
  deps = createDependencies({ config, mock, liveCommand: options.liveCommand });
  return createHttpServer(async ({ method, url, body, context }) => {
    if (url.pathname === '/health')
      return {
        status: 200,
        body: { status: 'ok', service: 'gateway', implementation: 'development' },
      };
    if (url.pathname === '/_mock/commands' && method === 'POST' && options.allowMockCommands) {
      return {
        status: 200,
        body: await mock.command(body.service, body.messageType, body.payload, context),
      };
    }
    if (url.pathname === '/api/v1/_dev/services' && method === 'GET')
      return {
        status: 200,
        body: {
          service: 'gateway',
          dependencies: Object.fromEntries(
            Object.entries(config.dependencies).map(([name, dep]) => [name, { mode: dep.mode }]),
          ),
          scenario: config.scenario,
        },
      };
    if (!url.pathname.startsWith('/api/v1/')) return notFound();
    const path = url.pathname.slice('/api/v1'.length) + url.search;
    const service = routeService(path) || notFound();
    return deps.request(service, method, path, body, context);
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 3001),
    config = readConfig(process.env);
  let kafka;
  if (process.env.MESSAGING_MODE === 'kafka') {
    const { createKafkaTransport } = await import('../kafka.mjs');
    kafka = await createKafkaTransport({
      name: process.env.SERVICE_ROLE || 'gateway',
      handler: { command: notFound },
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      timeoutMs: config.timeoutMs,
    });
  }
  const server = createGateway(config, {
    liveCommand: kafka?.command,
    allowMockCommands: process.env.SERVICE_ROLE === 'mock-hub',
  });
  server.listen(port, process.env.HOST || '127.0.0.1', () =>
    console.log(`Gateway: http://127.0.0.1:${port} (desenvolvimento)`),
  );
  process.on('SIGTERM', async () => {
    server.close();
    await kafka?.close();
  });
}
