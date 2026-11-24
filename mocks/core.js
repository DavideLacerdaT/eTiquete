import { canonical, fail, notFound, requireValue, uuid } from '../shared/contracts.js';

export function createStore(seed, key) {
  const records = new Map(structuredClone(seed).map((record) => [record[key], record]));

  return {
    records,
    get: (id) => records.get(id) || notFound(),
    list: () => [...records.values()],
    put: (record) => {
      records.set(record[key], record);

      return record;
    },
  };
}

// Reserva a Promise antes do primeiro await: chamadas concorrentes compartilham o resultado.
export function idempotency() {
  const entries = new Map();

  return async (operation, body, context, action) => {
    requireValue(
      typeof context.idempotencyKey === 'string' && context.idempotencyKey.length > 0,
      'Idempotency-Key é obrigatório.',
    );

    const key = `${operation}:${context.idempotencyKey}`;

    const fingerprint = canonical(body);

    const existing = entries.get(key);

    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        fail(409, 'IDEMPOTENCY_KEY_REUSED', 'Esta chave já foi usada com outro conteúdo.');
      }

      return structuredClone(await existing.result);
    }

    const result = Promise.resolve().then(action);

    entries.set(key, { fingerprint, result });

    try {
      return structuredClone(await result);
    } catch (error) {
      if (error.status >= 500) {
        entries.delete(key);
      }

      throw error;
    }
  };
}

export function contextWith(context = {}) {
  return { correlationId: uuid(), scenario: 'happy-path', ...context };
}

export const ok = (body) => ({ status: 200, body: structuredClone(body) });

export const created = (body) => ({ status: 201, body: structuredClone(body) });

export const accepted = (body) => ({ status: 202, body: structuredClone(body) });

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function taskRunner() {
  const pending = new Set();

  return {
    run(action) {
      const task = Promise.resolve().then(action);

      pending.add(task);

      task.finally(() => pending.delete(task)).catch(() => {});

      return task;
    },
    async settled() {
      while (pending.size) {
        await Promise.allSettled([...pending]);
      }
    },
  };
}
