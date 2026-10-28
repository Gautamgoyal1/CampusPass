import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { seed } from '../src/db/seed.js';
import { signAccessToken } from '../src/utils/tokens.js';

let server;
let baseUrl;

const postJson = async (path, body, token) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
};

const deleteJson = async (path, token) => {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'DELETE',
    headers
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
};

const getJson = async (path, token) => {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, { headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
};

describe('Booking Cancellation & Window Tests', () => {
  let student;
  let studentToken;

  before(async () => {
    await seed();
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://localhost:${port}/api/v1`;

    const { rows } = await pool.query("SELECT * FROM users WHERE email = 'alice@student.campuspass.edu'");
    student = rows[0];
    studentToken = signAccessToken(student);
  });

  after(async () => {
    server.close();
  });

  it('Allows cancellation when more than 2 hours remain before event starts', async () => {
    // Book event 4 (Design Thinking Seminar, starts in 120h, non-overlapping with seeded Event 1)
    const bookRes = await postJson('/events/4/bookings', null, studentToken);
    assert.equal(bookRes.status, 201);
    const bookingId = bookRes.data.data.booking.id;

    // Cancel booking
    const cancelRes = await deleteJson(`/bookings/${bookingId}`, studentToken);
    assert.equal(cancelRes.status, 200);
    assert.equal(cancelRes.data.data.booking.status, 'cancelled');
    assert.ok(cancelRes.data.data.booking.cancelled_at);

    // Verify booking history preserved in DB
    const { rows } = await pool.query('SELECT status, cancelled_at FROM bookings WHERE id = $1', [bookingId]);
    assert.equal(rows[0].status, 'cancelled');
    assert.ok(rows[0].cancelled_at);
  });

  it('Allows rebooking the same event after prior cancellation', async () => {
    // Alice cancelled her booking for event 4 above; now rebook it
    const rebookRes = await postJson('/events/4/bookings', null, studentToken);
    assert.equal(rebookRes.status, 201);
    assert.equal(rebookRes.data.data.booking.status, 'booked');

    // Attempting to book again while currently booked should fail
    const duplicateRes = await postJson('/events/4/bookings', null, studentToken);
    assert.equal(duplicateRes.status, 409);
    assert.equal(duplicateRes.data.code, 'ALREADY_BOOKED');
  });

  it('Rejects cancellation when less than 2 hours remain (CANCEL_WINDOW_CLOSED)', async () => {
    // Create an event that starts in 1 hour
    const now = new Date();
    const startsAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString(); // 1 hour ahead
    const endsAt = new Date(now.getTime() + 180 * 60 * 1000).toISOString();

    const eventRes = await pool.query(`
      INSERT INTO events (organiser_id, title, description, category, venue, starts_at, ends_at, capacity, status)
      VALUES (2, 'Starting Soon Workshop', 'Starts in 1 hour', 'Tech', 'Room 101', '${startsAt}', '${endsAt}', 10, 'approved')
      RETURNING id
    `);
    const imminentEventId = eventRes.rows[0].id;

    // Book it
    const bookRes = await postJson(`/events/${imminentEventId}/bookings`, null, studentToken);
    assert.equal(bookRes.status, 201);
    const bookingId = bookRes.data.data.booking.id;

    // Try to cancel: should be rejected
    const cancelRes = await deleteJson(`/bookings/${bookingId}`, studentToken);
    assert.equal(cancelRes.status, 409);
    assert.equal(cancelRes.data.code, 'CANCEL_WINDOW_CLOSED');
  });
});
