import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { createCatalogHandler } from '../../shared/catalog.js';

const readCatalog = `
  WITH selected_events AS (
    SELECT * FROM events
    WHERE published AND ($1::text IS NULL OR event_id::text = $1)
  ),
  selected_sessions AS (
    SELECT sessions.*
    FROM sessions JOIN selected_events USING (event_id)
    WHERE ($2::text IS NULL OR session_id::text = $2)
  )
  SELECT
    COALESCE((SELECT jsonb_agg(metadata || jsonb_build_object(
      'eventId', event_id, 'venueId', venue_id, 'title', title, 'category', category,
      'priceFromCents', price_from_cents
    ) ORDER BY event_id) FROM selected_events WHERE $2 IS NULL), '[]') AS events,
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'sessionId', session_id, 'eventId', event_id, 'venueId', venue_id,
      'startsAt', to_char(starts_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'priceCents', price_cents
    ) ORDER BY starts_at, session_id) FROM selected_sessions), '[]') AS sessions,
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'venueId', venue_id, 'name', name, 'city', city, 'address', address
    )) FROM venues WHERE venue_id IN (
      SELECT venue_id FROM selected_events WHERE $2 IS NULL
      UNION
      SELECT venue_id FROM selected_sessions
    )), '[]') AS venues
`;

async function seedCatalog(client) {
  const { venues, events, sessions } = await import('../../mocks/fixtures/catalog.js');

  await client.query(
    `INSERT INTO venues
     SELECT "venueId", name, city, address
     FROM jsonb_to_recordset($1::jsonb) AS v("venueId" uuid, name text, city text, address text)
     ON CONFLICT (venue_id) DO NOTHING`,
    [JSON.stringify(venues)],
  );

  await client.query(
    `INSERT INTO events (event_id, venue_id, title, category, price_from_cents, published, metadata)
     SELECT (event->>'eventId')::uuid, (event->>'venueId')::uuid, event->>'title',
       event->>'category', (event->>'priceFromCents')::integer, true,
       event - ARRAY['eventId', 'venueId', 'title', 'category', 'priceFromCents']
     FROM jsonb_array_elements($1::jsonb) AS input(event)
     ON CONFLICT (event_id) DO NOTHING`,
    [JSON.stringify(events)],
  );

  await client.query(
    `INSERT INTO sessions (session_id, event_id, venue_id, starts_at, price_cents)
     SELECT "sessionId", "eventId", "venueId", "startsAt", "priceCents"
     FROM jsonb_to_recordset($1::jsonb) AS s(
       "sessionId" uuid, "eventId" uuid, "venueId" uuid, "startsAt" timestamptz, "priceCents" integer
     )
     ON CONFLICT (session_id) DO NOTHING`,
    [JSON.stringify(sessions)],
  );
}

export async function openPostgresCatalog(env, timeoutMs) {
  const pool = new pg.Pool({
    connectionString: env.CATALOG_DATABASE_URL,
    database: 'catalog',
    connectionTimeoutMillis: timeoutMs,
    statement_timeout: timeoutMs,
  });

  pool.on('error', (error) => console.error('Catalog PostgreSQL:', error.message));

  try {
    const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(3011)');
      await client.query(schema);

      if (env.CATALOG_SEED_DEMO === 'true') {
        await seedCatalog(client);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    await pool.end();
    throw error;
  }

  const handler = createCatalogHandler(async (_context, [resource, id]) => {
    const eventId = resource === 'events' ? id : null;
    const sessionId = resource === 'sessions' ? id : null;
    const { rows } = await pool.query(readCatalog, [eventId, sessionId]);

    return rows[0];
  });

  return { handler, close: () => pool.end(), check: () => pool.query('SELECT 1') };
}
