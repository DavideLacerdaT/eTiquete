CREATE TABLE IF NOT EXISTS venues (
  venue_id uuid PRIMARY KEY,
  name text NOT NULL,
  city text NOT NULL,
  address text NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  event_id uuid PRIMARY KEY,
  venue_id uuid NOT NULL REFERENCES venues (venue_id),
  title text NOT NULL,
  category text NOT NULL,
  price_from_cents integer NOT NULL CHECK (price_from_cents >= 0),
  published boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id uuid PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES events (event_id),
  venue_id uuid NOT NULL REFERENCES venues (venue_id),
  starts_at timestamptz NOT NULL,
  price_cents integer NOT NULL CHECK (price_cents >= 0)
);

CREATE INDEX IF NOT EXISTS sessions_event_start_idx ON sessions (event_id, starts_at, session_id);
