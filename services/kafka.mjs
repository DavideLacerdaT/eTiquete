import { Kafka, logLevel } from 'kafkajs';
import { ApiError, envelope, isUuid, uuid } from '../shared/contracts.js';
import { services } from '../mocks/fixtures.js';

// Adaptador de desenvolvimento real: Kafka transporta comando e resultado.
// Inbox em memória; produção exige Inbox/Outbox transacionais e recuperação da SAGA.
export async function createKafkaTransport({ name, handler, brokers, timeoutMs = 5000 }) {
  const kafka = new Kafka({
    clientId: `etiquete-${name}`,
    brokers,
    logLevel: logLevel.ERROR,
    retry: { retries: 3 },
  });

  const producer = kafka.producer();

  const pending = new Map();

  const inbox = new Map();

  const consumer = kafka.consumer({ groupId: `${name}-development`, allowAutoTopicCreation: true });

  await producer.connect();

  await consumer.connect();

  await consumer.subscribe({
    topics: [...services.map((s) => `etiquete.${s}.events`), `etiquete.${name}.commands`],
    fromBeginning: false,
  });

  const publish = (topic, message) =>
    producer.send({
      topic,
      acks: -1,
      messages: [{ key: message.aggregateId, value: JSON.stringify(message) }],
    });

  await consumer.run({
    autoCommit: false,
    eachMessage: async ({ topic, partition, message }) => {
      let event;

      try {
        event = JSON.parse(message.value.toString());

        if (
          !isUuid(event.messageId) ||
          !isUuid(event.aggregateId) ||
          !isUuid(event.correlationId) ||
          event.messageVersion !== 1 ||
          typeof event.messageType !== 'string' ||
          !event.payload
        ) {
          throw new Error('Invalid envelope');
        }
      } catch {
        event = null;

        await producer.send({
          topic: `${topic}.dlq`,
          messages: [
            {
              value: JSON.stringify({
                raw: message.value?.toString(),
                topic,
                partition,
                offset: message.offset,
                reason: 'INVALID_ENVELOPE',
                attempts: 1,
                occurredAt: new Date().toISOString(),
              }),
            },
          ],
        });
      }

      if (event && topic.endsWith('.commands')) {
        let result = inbox.get(event.messageId);

        if (!result) {
          let payload;

          try {
            payload = {
              result: await handler.command(event.messageType, event.payload, {
                correlationId: event.correlationId,
                messageId: event.messageId,
              }),
            };
          } catch (error) {
            payload = {
              error: {
                status: error.status || 500,
                code: error.code || 'INTERNAL_ERROR',
                message: error.message,
              },
            };
          }

          const names = {
            'payment.charge':
              payload.result?.status === 'FAILED' ? 'payment.failed' : 'payment.succeeded',
            'payment.refund': 'payment.refunded',
            'reservation.hold': 'reservation.held',
            'reservation.confirm': 'reservation.confirmed',
            'reservation.release': 'reservation.released',
            'reservation.cancel': 'reservation.cancelled',
            'notification.send':
              payload.result?.status === 'FAILED' ? 'notification.failed' : 'notification.sent',
          };

          result = envelope(
            payload.error ? `${event.messageType}.failed` : names[event.messageType],
            `${name}-service`,
            event.aggregateId,
            payload.error ? payload : payload.result,
            { correlationId: event.correlationId, messageId: event.messageId },
          );

          inbox.set(event.messageId, result);
        }

        await publish(`etiquete.${name}.events`, result);
      } else if (event && pending.has(event.causationId)) {
        const request = pending.get(event.causationId);

        clearTimeout(request.timer);

        pending.delete(event.causationId);

        if (event.payload.error) {
          const e = event.payload.error;

          request.reject(new ApiError(e.status, e.code, e.message));
        } else {
          request.resolve(event.payload);
        }
      }

      await consumer.commitOffsets([
        { topic, partition, offset: (BigInt(message.offset) + 1n).toString() },
      ]);
    },
  });

  return {
    async command(service, type, payload, context) {
      const message = envelope(
        type,
        `${name}-service`,
        payload.orderId || payload.reservationId || uuid(),
        payload,
        context,
      );

      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(message.messageId);

          reject(
            new ApiError(
              503,
              'DEPENDENCY_UNAVAILABLE',
              'Tempo de espera do resultado Kafka excedido.',
            ),
          );
        }, timeoutMs);

        pending.set(message.messageId, { resolve, reject, timer });

        publish(`etiquete.${service}.commands`, message).catch((error) => {
          clearTimeout(timer);

          pending.delete(message.messageId);

          reject(new ApiError(503, 'DEPENDENCY_UNAVAILABLE', error.message));
        });
      });
    },
    async close() {
      for (const request of pending.values()) {
        clearTimeout(request.timer);

        request.reject(new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'Transporte encerrado.'));
      }

      pending.clear();

      await consumer.disconnect();

      await producer.disconnect();
    },
  };
}
