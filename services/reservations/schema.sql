CREATE TABLE IF NOT EXISTS reservations (
  reservation_id uuid PRIMARY KEY,
  username text NOT NULL CHECK (length(btrim(username)) BETWEEN 2 AND 80),
  items jsonb NOT NULL CHECK (jsonb_typeof(items) = 'array'),
  status text NOT NULL CHECK (status IN ('HELD', 'CONFIRMED', 'RELEASED', 'EXPIRED')),
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  expires_at timestamptz NOT NULL,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  order_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (confirmed_at IS NULL OR status = 'CONFIRMED'),
  CHECK (cancelled_at IS NULL OR status = 'CONFIRMED')
);

CREATE TABLE IF NOT EXISTS seats (
  session_id uuid NOT NULL,
  seat_id uuid NOT NULL,
  section text NOT NULL,
  seat_row text NOT NULL,
  seat_number text NOT NULL,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  status text NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'HELD', 'SOLD')),
  reservation_id uuid REFERENCES reservations (reservation_id),
  PRIMARY KEY (session_id, seat_id),
  UNIQUE (session_id, section, seat_row, seat_number),
  CHECK (status <> 'AVAILABLE' OR reservation_id IS NULL),
  CHECK (status <> 'HELD' OR reservation_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS seats_reservation_idx ON seats (reservation_id)
  WHERE reservation_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS reservation_seats (
  reservation_id uuid NOT NULL REFERENCES reservations (reservation_id),
  session_id uuid NOT NULL,
  seat_id uuid NOT NULL,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  PRIMARY KEY (reservation_id, session_id, seat_id),
  FOREIGN KEY (session_id, seat_id) REFERENCES seats (session_id, seat_id)
);

CREATE TABLE IF NOT EXISTS reservation_idempotency (
  operation text NOT NULL,
  idempotency_key text NOT NULL,
  fingerprint text NOT NULL,
  response jsonb NOT NULL,
  PRIMARY KEY (operation, idempotency_key)
);

CREATE INDEX IF NOT EXISTS reservations_expiry_idx ON reservations (expires_at)
  WHERE status = 'HELD';
