import { fail, isUuid, notFound, requireValue, uuid } from '../../shared/contracts.js';
import { accepted, createStore, ok } from '../core.js';

export function createAdmissions({ deps, now = Date.now }) {
  const store = createStore([], 'admissionTokenId');

  const view = (record) => {
    if (record.status === 'WAITING' && now() >= record.readyAt) {
      Object.assign(record, {
        status: 'ADMITTED',
        token: uuid(),
        expiresAt: new Date(now() + 600000).toISOString(),
      });
    }

    if (record.expiresAt && now() >= Date.parse(record.expiresAt)) {
      record.status = 'EXPIRED';
    }

    const { readyAt, ...result } = record;

    if (record.status === 'WAITING') {
      return {
        ...result,
        position: Math.max(1, Math.ceil((readyAt - now()) / 1000)),
        estimatedWaitSeconds: Math.max(1, Math.ceil((readyAt - now()) / 1000)),
      };
    }

    return result;
  };

  return {
    async handle(method, parts, body, context) {
      if (method === 'POST' && parts[1] === 'validate') {
        const record = store.list().find((item) => item.token === body.token);

        if (!record || view(record).status !== 'ADMITTED') {
          fail(403, 'ADMISSION_REQUIRED', 'Entre na fila novamente para continuar.');
        }

        return ok({ valid: true, ...view(record) });
      }

      if (method === 'POST' && parts.length === 1) {
        requireValue(
          isUuid(body.eventId) && isUuid(body.sessionId),
          'Evento e sessão são obrigatórios.',
        );

        const session = (
          await deps.request('catalog', 'GET', `/sessions/${body.sessionId}`, undefined, context)
        ).body;

        requireValue(session.eventId === body.eventId, 'A sessão não pertence ao evento.');

        const record = store.put({
          admissionTokenId: uuid(),
          eventId: body.eventId,
          sessionId: body.sessionId,
          status: 'WAITING',
          readyAt: now() + (context.scenario === 'queue' ? 8000 : 0),
        });

        return accepted(view(record));
      }

      if (method === 'GET' && parts.length === 2) {
        return ok(view(store.get(parts[1])));
      }

      return notFound();
    },
  };
}
