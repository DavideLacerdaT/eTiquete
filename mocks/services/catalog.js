import { createCatalogHandler } from '../../shared/catalog.js';
import { events, sessions, venues } from '../fixtures.js';

export function createCatalog() {
  return createCatalogHandler((context, parts) => ({
    events: context.scenario === 'empty' && !parts[1] ? [] : events,
    sessions,
    venues,
  }));
}
