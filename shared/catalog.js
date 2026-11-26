import { notFound, paginate } from './contracts.js';

const ok = (body) => ({ status: 200, body: structuredClone(body) });

export function createCatalogHandler(readCatalog) {
  return {
    async handle(method, parts, body, context, query) {
      if (method !== 'GET') {
        return notFound();
      }

      const { events, sessions, venues } = await readCatalog(context, parts);

      const eventView = (event) => ({
        ...event,
        venue: venues.find((v) => v.venueId === event.venueId),
        sessions: sessions.filter((s) => s.eventId === event.eventId),
      });

      if (parts[0] === 'events') {
        if (!parts[1]) {
          const search = (query.get('search') || '').toLocaleLowerCase('pt-BR');

          const category = query.get('category');

          const items = events.filter(
            (event) =>
              `${event.title} ${event.category}`.toLocaleLowerCase('pt-BR').includes(search) &&
              (!category || event.category === category),
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
