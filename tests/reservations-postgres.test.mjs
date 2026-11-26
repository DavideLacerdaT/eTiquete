import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import { openPostgresReservations } from '../services/reservations/postgres.mjs';
import { uuid } from '../shared/contracts.js';

test(
  'PostgreSQL adquire assentos atomicamente e persiste transições e idempotência',
  { skip: !process.env.RESERVATIONS_TEST_DATABASE_URL },
  async (t) => {
    const connectionString = process.env.RESERVATIONS_TEST_DATABASE_URL;

    const database = await openPostgresReservations(
      { RESERVATIONS_DATABASE_URL: connectionString },
      5000,
      {
        request: async () => ({ body: { sessionId } }),
      },
    );

    t.after(() => database.close());

    const pool = new pg.Pool({ connectionString });

    t.after(() => pool.end());

    const sessionId = uuid();

    const seatId = uuid();

    const secondSeatId = uuid();

    await pool.query(
      `INSERT INTO seats (session_id, seat_id, section, seat_row, seat_number, price_cents)
       VALUES ($1, $2, 'A', '01', '01', 12000), ($1, $3, 'A', '01', '02', 12000)`,
      [sessionId, seatId, secondSeatId],
    );

    const body = {
      username: 'marina',
      items: [{ sessionId, seatIds: [seatId] }],
      expiresInSeconds: 600,
    };

    const context = () => ({ idempotencyKey: uuid(), admissionToken: 'test-token' });

    const attempts = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        database.handler.handle('POST', ['reservations'], body, context()),
      ),
    );

    assert.equal(attempts.filter((attempt) => attempt.status === 'fulfilled').length, 1);

    assert.ok(
      attempts
        .filter((attempt) => attempt.status === 'rejected')
        .every((attempt) => attempt.reason.code === 'SEAT_UNAVAILABLE'),
    );

    const first = attempts.find((attempt) => attempt.status === 'fulfilled').value.body;

    assert.equal(first.status, 'HELD');

    await assert.rejects(
      database.handler.handle(
        'POST',
        ['reservations'],
        { ...body, items: [{ sessionId, seatIds: [seatId, secondSeatId] }] },
        context(),
      ),
      (error) => error.code === 'SEAT_UNAVAILABLE',
    );

    const seatMap = await database.handler.handle('GET', ['sessions', sessionId, 'seats']);

    assert.equal(seatMap.body.seats[0].status, 'HELD');

    assert.equal(seatMap.body.seats[1].status, 'AVAILABLE');

    await database.handler.handle('POST', ['reservations', first.reservationId, 'release'], {});

    assert.equal(
      (await database.handler.handle('POST', ['reservations', first.reservationId, 'release'], {}))
        .body.status,
      'RELEASED',
    );

    assert.equal(
      (await database.handler.handle('GET', ['sessions', sessionId, 'seats'])).body.seats[0].status,
      'AVAILABLE',
    );

    const key = context();

    const held = (await database.handler.handle('POST', ['reservations'], body, key)).body;

    assert.equal(
      (await database.handler.handle('POST', ['reservations'], body, key)).body.reservationId,
      held.reservationId,
    );

    await assert.rejects(
      database.handler.handle('POST', ['reservations'], { ...body, username: 'outra' }, key),
      (error) => error.code === 'IDEMPOTENCY_KEY_REUSED',
    );

    const confirmed = (
      await database.handler.handle('POST', ['reservations', held.reservationId, 'confirm'], {
        orderId: uuid(),
      })
    ).body;

    assert.equal(confirmed.status, 'CONFIRMED');

    assert.equal(
      (
        await database.handler.handle('POST', ['reservations', held.reservationId, 'confirm'], {
          orderId: uuid(),
        })
      ).body.confirmedAt,
      confirmed.confirmedAt,
    );

    assert.equal(
      (await database.handler.handle('GET', ['sessions', sessionId, 'seats'])).body.seats[0].status,
      'SOLD',
    );

    await assert.rejects(
      database.handler.handle('POST', ['reservations', held.reservationId, 'release'], {}),
      (error) => error.code === 'INVALID_STATE_TRANSITION',
    );

    const short = (
      await database.handler.handle(
        'POST',
        ['reservations'],
        { ...body, items: [{ sessionId, seatIds: [secondSeatId] }], expiresInSeconds: 1 },
        context(),
      )
    ).body;

    await new Promise((resolve) => setTimeout(resolve, 1100));

    assert.equal(
      (await database.handler.handle('GET', ['reservations', short.reservationId])).body.status,
      'EXPIRED',
    );

    assert.equal(
      (await database.handler.handle('GET', ['sessions', sessionId, 'seats'])).body.seats[1].status,
      'AVAILABLE',
    );

    await assert.rejects(
      database.handler.handle('POST', ['reservations', short.reservationId, 'confirm'], {}),
      (error) => error.code === 'RESERVATION_EXPIRED',
    );
  },
);
