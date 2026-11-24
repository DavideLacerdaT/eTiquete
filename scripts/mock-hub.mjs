process.env.SERVICE_ROLE = 'mock-hub';

process.env.PORT ||= '3090';
// O hub é a raiz dos mocks; nunca encaminha mocks para ele próprio.

delete process.env.MOCK_BASE_URL;

const { createGateway } = await import('../services/gateway/server.mjs');

const { readConfig } = await import('../shared/config.js');

const config = readConfig(process.env);

let kafka;

if (process.env.MESSAGING_MODE === 'kafka') {
  const { createKafkaTransport } = await import('../services/kafka.mjs');

  const { notFound } = await import('../shared/contracts.js');

  kafka = await createKafkaTransport({
    name: 'mock-hub',
    handler: { command: notFound },
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    timeoutMs: config.timeoutMs,
  });
}

const server = createGateway(config, { allowMockCommands: true, liveCommand: kafka?.command });

server.listen(Number(process.env.PORT), process.env.HOST || '127.0.0.1', () =>
  console.log(`Mock hub: http://127.0.0.1:${process.env.PORT}`),
);

process.on('SIGTERM', async () => {
  server.close();

  await kafka?.close();
});
