import { events, sessions, venues } from '../fixtures.js';
import { notFound, paginate } from '../../shared/contracts.js';
import { ok } from '../core.js';

export function createCatalog() {
  const eventView = (event) => ({
    ...event,
    venue: venues.find((v) => v.venueId === event.venueId),
    sessions: sessions.filter((s) => s.eventId === event.eventId),
  });

  return {
    async handle(method, parts, body, context, query) {
      if (method !== 'GET') {
        return notFound();
      }

      if (parts[0] === 'events') {
        if (!parts[1]) {
          const search = (query.get('search') || '').toLocaleLowerCase('pt-BR');

          const category = query.get('category');

          const items =
            context.scenario === 'empty'
              ? []
              : events.filter(
                  (e) =>
                    `${e.title} ${e.category}`.toLocaleLowerCase('pt-BR').includes(search) &&
                    (!category || e.category === category),
                );

          return ok(paginate(items.map(eventView), query));
        }

        const event = events.find((e) => e.eventId === parts[1]) || notFound();

        if (parts[2] === 'sessions' && parts.length === 3) {
          return ok({ items: sessions.filter((s) => s.eventId === event.eventId) });
        }

        if (parts.length === 2) {
          return ok(eventView(event));
        }
      }

      if (parts[0] === 'sessions' && parts.length === 2) {
        const session = sessions.find((s) => s.sessionId === parts[1]) || notFound();

        return ok({ ...session, venue: venues.find((v) => v.venueId === session.venueId) });
      }

      return notFound();
    },
  };
}
