import { readFile } from 'node:fs/promises';
import pg from 'pg';
import {
  canonical,
  fail,
  isUuid,
  notFound,
  paginate,
  requireValue,
  uuid,
  validateItems,
} from '../../shared/contracts.js';
import { created, ok } from '../../mocks/core.js';

const reservationColumns = `
  reservation_id AS "reservationId", username, items, status, amount_cents AS "amountCents",
  expires_at AS "expiresAt", confirmed_at AS "confirmedAt", cancelled_at AS "cancelledAt",
  cancellation_reason AS "cancellationReason", order_id AS "orderId"
`;

async function transaction(pool, action) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await action(client);

    await client.query('COMMIT');

    return result;
  } catch (error) {
    await client.query('ROLLBACK');

    throw error;
  } finally {
    client.release();
  }
}

function iso(value) {
  return value?.toISOString() ?? null;
}

async function readReservation(client, reservationId, lock = false) {
  const { rows } = await client.query(
    `SELECT ${reservationColumns} FROM reservations WHERE reservation_id = $1 ${lock ? 'FOR UPDATE' : ''}`,
    [reservationId],
  );

  const row = rows[0];

  if (!row) {
    return notFound();
  }

  return {
    reservationId: row.reservationId,
    username: row.username,
    items: row.items,
    status: row.status,
    amountCents: row.amountCents,
    expiresAt: iso(row.expiresAt),
    ...(row.confirmedAt && { confirmedAt: iso(row.confirmedAt) }),
    ...(row.cancelledAt && { cancelledAt: iso(row.cancelledAt) }),
    ...(row.cancellationReason && { cancellationReason: row.cancellationReason }),
    ...(row.orderId && { orderId: row.orderId }),
  };
}

async function expire(client) {
  const { rows } = await client.query(
    `UPDATE reservations SET status = 'EXPIRED'
     WHERE status = 'HELD' AND expires_at <= now() RETURNING reservation_id`,
  );

  if (rows.length) {
    await client.query(
      `UPDATE seats SET status = 'AVAILABLE', reservation_id = NULL
       WHERE reservation_id = ANY($1::uuid[]) AND status = 'HELD'`,
      [rows.map((row) => row.reservation_id)],
    );
  }
}

async function seedDemo(client) {
  const { seats } = await import('../../mocks/fixtures/reservations.js');

  await client.query(
    `INSERT INTO seats (session_id, seat_id, section, seat_row, seat_number, price_cents, status)
     SELECT "sessionId", "seatId", section, "row", number, "priceCents", status
     FROM jsonb_to_recordset($1::jsonb) AS s(
       "sessionId" uuid, "seatId" uuid, section text, "row" text,
       number text, "priceCents" integer, status text
     ) ON CONFLICT (session_id, seat_id) DO NOTHING`,
    [JSON.stringify(seats)],
  );
}

export async function openPostgresReservations(env, timeoutMs, deps) {
  const pool = new pg.Pool({
    connectionString: env.RESERVATIONS_DATABASE_URL,
    database: 'reservation',
    connectionTimeoutMillis: timeoutMs,
    statement_timeout: timeoutMs,
  });

  pool.on('error', (error) => console.error('Reservations PostgreSQL:', error.message));

  try {
    await transaction(pool, async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(3013)');

      await client.query(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));

      if (env.RESERVATIONS_SEED_DEMO === 'true') {
        await seedDemo(client);
      }
    });
  } catch (error) {
    await pool.end();

    throw error;
  }

  async function hold(body, context) {
    validateItems(body.items);

    requireValue(
      typeof body.username === 'string' &&
        body.username.trim().length >= 2 &&
        body.username.length <= 80,
      'Informe seu nome de usuário (2–80 caracteres).',
    );

    const ttl = body.expiresInSeconds ?? 600;

    requireValue(
      Number.isInteger(ttl) && ttl > 0 && ttl <= 600,
      'O prazo deve ser de 1 a 600 segundos.',
    );

    requireValue(
      typeof context.idempotencyKey === 'string' && context.idempotencyKey.length > 0,
      'Idempotency-Key é obrigatório.',
    );

    const fingerprint = canonical(body);

    const previous = await pool.query(
      `SELECT fingerprint, response FROM reservation_idempotency
       WHERE operation = 'hold' AND idempotency_key = $1`,
      [context.idempotencyKey],
    );

    if (previous.rows.length) {
      if (previous.rows[0].fingerprint !== fingerprint) {
        fail(409, 'IDEMPOTENCY_KEY_REUSED', 'Esta chave já foi usada com outro conteúdo.');
      }

      return created(previous.rows[0].response);
    }

    if (!context.internalCommand) {
      if (!context.admissionToken) {
        fail(403, 'ADMISSION_REQUIRED', 'A admissão é obrigatória.');
      }

      const admission = (
        await deps.request(
          'admissions',
          'POST',
          '/admissions/validate',
          { token: context.admissionToken },
          context,
        )
      ).body;

      requireValue(
        body.items.some((item) => item.sessionId === admission.sessionId),
        'A admissão deve corresponder a uma sessão da compra.',
      );
    }

    return transaction(pool, async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [context.idempotencyKey]);

      const previous = await client.query(
        `SELECT fingerprint, response FROM reservation_idempotency
         WHERE operation = 'hold' AND idempotency_key = $1`,
        [context.idempotencyKey],
      );

      if (previous.rows.length) {
        if (previous.rows[0].fingerprint !== fingerprint) {
          fail(409, 'IDEMPOTENCY_KEY_REUSED', 'Esta chave já foi usada com outro conteúdo.');
        }

        return created(previous.rows[0].response);
      }

      await expire(client);

      const requested = body.items.flatMap((item) =>
        item.seatIds.map((seatId) => ({ sessionId: item.sessionId, seatId })),
      );

      requested.sort((a, b) =>
        `${a.sessionId}:${a.seatId}`.localeCompare(`${b.sessionId}:${b.seatId}`),
      );

      const selected = [];

      for (const seat of requested) {
        const { rows } = await client.query(
          `SELECT price_cents, status FROM seats
           WHERE session_id = $1 AND seat_id = $2 FOR UPDATE`,
          [seat.sessionId, seat.seatId],
        );

        if (
          !rows.length ||
          rows[0].status !== 'AVAILABLE' ||
          context.scenario === 'seat-conflict'
        ) {
          fail(
            409,
            'SEAT_UNAVAILABLE',
            'Um dos assentos acabou de ser reservado. Escolha outro lugar.',
          );
        }

        selected.push({ ...seat, priceCents: rows[0].price_cents });
      }

      const reservationId = context.commandReservationId || uuid();

      const expiresInSeconds = ['reservation-expired', 'late-payment'].includes(context.scenario)
        ? 5
        : ttl;

      await client.query(
        `INSERT INTO reservations
         (reservation_id, username, items, status, amount_cents, expires_at)
         VALUES ($1, $2, $3::jsonb, 'HELD', $4, now() + $5::integer * interval '1 second')`,
        [
          reservationId,
          body.username.trim(),
          JSON.stringify(body.items),
          selected.reduce((sum, seat) => sum + seat.priceCents, 0),
          expiresInSeconds,
        ],
      );

      for (const seat of selected) {
        await client.query(
          `INSERT INTO reservation_seats (reservation_id, session_id, seat_id, price_cents)
           VALUES ($1, $2, $3, $4)`,
          [reservationId, seat.sessionId, seat.seatId, seat.priceCents],
        );

        await client.query(
          `UPDATE seats SET status = 'HELD', reservation_id = $3
           WHERE session_id = $1 AND seat_id = $2`,
          [seat.sessionId, seat.seatId, reservationId],
        );
      }

      const record = await readReservation(client, reservationId);

      await client.query(
        `INSERT INTO reservation_idempotency (operation, idempotency_key, fingerprint, response)
         VALUES ('hold', $1, $2, $3::jsonb)`,
        [context.idempotencyKey, fingerprint, JSON.stringify(record)],
      );

      return created(record);
    });
  }

  async function transition(reservationId, action, payload = {}) {
    requireValue(isUuid(reservationId), 'reservationId deve ser UUID.');

    requireValue(!payload.orderId || isUuid(payload.orderId), 'orderId deve ser UUID.');

    return transaction(pool, async (client) => {
      await expire(client);

      const record = await readReservation(client, reservationId, true);

      if (action === 'confirm') {
        if (record.status === 'EXPIRED') {
          fail(410, 'RESERVATION_EXPIRED', 'O prazo da reserva terminou.');
        }

        if (record.status === 'RELEASED') {
          fail(409, 'INVALID_STATE_TRANSITION', 'Uma reserva liberada não pode ser confirmada.');
        }

        if (record.status === 'HELD') {
          await client.query(
            `UPDATE reservations SET status = 'CONFIRMED', confirmed_at = now(), order_id = $2
             WHERE reservation_id = $1`,
            [reservationId, payload.orderId || null],
          );

          await client.query(
            `UPDATE seats SET status = 'SOLD' WHERE reservation_id = $1 AND status = 'HELD'`,
            [reservationId],
          );
        }
      } else if (action === 'release') {
        if (record.status === 'CONFIRMED') {
          fail(
            409,
            'INVALID_STATE_TRANSITION',
            'A liberação normal não cancela ingressos confirmados.',
          );
        }

        if (record.status === 'HELD') {
          await client.query(
            `UPDATE reservations SET status = 'RELEASED' WHERE reservation_id = $1`,
            [reservationId],
          );

          await client.query(
            `UPDATE seats SET status = 'AVAILABLE', reservation_id = NULL
             WHERE reservation_id = $1 AND status = 'HELD'`,
            [reservationId],
          );
        }
      } else if (action === 'cancel-confirmed') {
        requireValue(record.status === 'CONFIRMED', 'A reserva precisa estar confirmada.');

        await client.query(
          `UPDATE reservations SET cancelled_at = COALESCE(cancelled_at, now()),
           cancellation_reason = COALESCE(cancellation_reason, $2)
           WHERE reservation_id = $1`,
          [reservationId, payload.reason || null],
        );
      } else {
        return notFound();
      }

      return ok(await readReservation(client, reservationId));
    });
  }

  const handler = {
    async handle(method, parts, body, context, query = new URLSearchParams()) {
      if (method === 'POST' && parts.length === 1 && parts[0] === 'reservations') {
        return hold(body, context);
      }

      if (method === 'POST' && parts.length === 3 && parts[0] === 'reservations') {
        return transition(parts[1], parts[2], body);
      }

      if (
        method === 'GET' &&
        ((parts[0] === 'sessions' && parts.length === 3) ||
          (parts[0] === 'reservations' && parts.length === 2)) &&
        !isUuid(parts[1])
      ) {
        return notFound();
      }

      return transaction(pool, async (client) => {
        await expire(client);

        if (
          method === 'GET' &&
          parts[0] === 'sessions' &&
          parts[2] === 'seats' &&
          parts.length === 3
        ) {
          const { rows } = await client.query(
            `SELECT seat_id AS "seatId", section, seat_row AS "row", seat_number AS number,
             status, price_cents AS "priceCents" FROM seats
             WHERE session_id = $1 ORDER BY section, seat_row, seat_number`,
            [parts[1]],
          );

          if (!rows.length) {
            return notFound();
          }

          return ok({
            sessionId: parts[1],
            seats: rows.map((row) => ({ sessionId: parts[1], ...row })),
          });
        }

        if (method === 'GET' && parts[0] === 'reservations' && parts.length === 2) {
          return ok(await readReservation(client, parts[1]));
        }

        if (method === 'GET' && parts[0] === 'reservations' && parts.length === 1) {
          const { rows } = await client.query(
            `SELECT reservation_id FROM reservations
             WHERE ($1::text IS NULL OR username = $1)
             ORDER BY created_at DESC, reservation_id`,
            [query.get('username')],
          );

          const records = [];

          for (const row of rows) {
            records.push(await readReservation(client, row.reservation_id));
          }

          return ok(paginate(records, query));
        }

        return notFound();
      });
    },
    async command(type, payload, context = {}) {
      if (type === 'reservation.hold') {
        requireValue(isUuid(payload.reservationId), 'reservationId deve ser UUID.');

        const { reservationId, orderId, ...body } = payload;

        const existing = await transaction(pool, async (client) => {
          await expire(client);

          const { rows } = await client.query(
            'SELECT reservation_id FROM reservations WHERE reservation_id = $1',
            [reservationId],
          );

          return rows.length ? readReservation(client, reservationId) : null;
        });

        if (existing) {
          if (
            existing.username !== body.username ||
            canonical(existing.items) !== canonical(body.items)
          ) {
            fail(409, 'IDEMPOTENCY_KEY_REUSED', 'A reserva já existe com outros dados.');
          }

          return existing;
        }

        return (
          await hold(body, {
            ...context,
            internalCommand: true,
            commandReservationId: reservationId,
            idempotencyKey: `hold:${reservationId}`,
          })
        ).body;
      }

      if (type === 'reservation.confirm') {
        return (await transition(payload.reservationId, 'confirm', payload)).body;
      }

      if (type === 'reservation.release') {
        return (await transition(payload.reservationId, 'release', payload)).body;
      }

      if (type === 'reservation.cancel') {
        return (await transition(payload.reservationId, 'cancel-confirmed', payload)).body;
      }

      return notFound();
    },
  };

  return { handler, close: () => pool.end(), check: () => pool.query('SELECT 1') };
}
