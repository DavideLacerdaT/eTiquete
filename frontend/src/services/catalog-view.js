import { catalog } from '../api.js';
import { listAll } from './pagination.js';

async function withSessions(event, options) {
  const sessions = await catalog.sessions(event.eventId, options);

  return { ...event, sessions: sessions.items };
}

export async function loadEvent(eventId, options) {
  const event = await catalog.get(eventId, options);

  return withSessions(event, options);
}

export async function loadCatalog(query = {}, options) {
  const events = await listAll(catalog.list, query, options);

  return Promise.all(events.map((event) => withSessions(event, options)));
}
