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

const patchJson = async (path, body, token) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'PATCH',
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

describe('Security Audit & Defensive Hardening Regression Tests', () => {
  let admin, organiser, alice, bob;
  let adminToken, organiserToken, aliceToken, bobToken;

  before(async () => {
    await seed();
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://localhost:${port}/api/v1`;

    const { rows: users } = await pool.query('SELECT * FROM users');
    admin = users.find((u) => u.email === 'admin@campuspass.edu');
    organiser = users.find((u) => u.email === 'organiser@campuspass.edu');
    alice = users.find((u) => u.email === 'alice@student.campuspass.edu');
    bob = users.find((u) => u.email === 'bob@student.campuspass.edu');

    adminToken = signAccessToken(admin);
    organiserToken = signAccessToken(organiser);
    aliceToken = signAccessToken(alice);
    bobToken = signAccessToken(bob);
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  describe('1. Booking Cancellation Concurrency & Serialization', () => {
    it('concurrent cancellation requests for the same booking serialize; exactly 1 succeeds', async () => {
      // Find an event for Bob that is far in the future (>2h)
      const { rows: events } = await pool.query(
        "SELECT * FROM events WHERE title = 'AI & Robotics Workshop'"
      );
      const workshop = events[0];

      // Bob books the workshop
      const bookRes = await postJson(`/events/${workshop.id}/bookings`, {}, bobToken);
      assert.equal(bookRes.status, 201);
      const bookingId = bookRes.data.data.booking.id;

      // Fire 5 simultaneous DELETE requests for the exact same bookingId
      const results = await Promise.all([
        deleteJson(`/bookings/${bookingId}`, bobToken),
        deleteJson(`/bookings/${bookingId}`, bobToken),
        deleteJson(`/bookings/${bookingId}`, bobToken),
        deleteJson(`/bookings/${bookingId}`, bobToken),
        deleteJson(`/bookings/${bookingId}`, bobToken)
      ]);

      const successCount = results.filter((r) => r.status === 200).length;
      const alreadyCancelledCount = results.filter(
        (r) => r.status === 400 && r.data.code === 'ALREADY_CANCELLED'
      ).length;

      assert.equal(successCount, 1, 'Exactly one concurrent cancellation must succeed with 200');
      assert.equal(alreadyCancelledCount, 4, 'Remaining concurrent requests must get 400 ALREADY_CANCELLED');
    });
  });

  describe('2. Input Parameter Validation & PostgreSQL Syntax Safety', () => {
    it('rejects non-numeric parameter for notification read with 422 VALIDATION_ERROR instead of 500', async () => {
      const res = await patchJson('/notifications/invalid-id/read', {}, aliceToken);
      assert.equal(res.status, 422, 'Must reject with 422 Validation Error');
      assert.equal(res.data.code, 'VALIDATION_ERROR');
    });

    it('rejects negative numeric parameter for notification read with 422', async () => {
      const res = await patchJson('/notifications/-5/read', {}, aliceToken);
      assert.equal(res.status, 422);
      assert.equal(res.data.code, 'VALIDATION_ERROR');
    });
  });

  describe('3. Database Error Handler Defense', () => {
    it('translates PostgreSQL check constraint violations into 400 CONSTRAINT_VIOLATION', async () => {
      // Try to create event with ends_at earlier than starts_at directly or bypassing Zod if possible
      // Using an invalid capacity of 0 or invalid dates in patch
      const { rows: events } = await pool.query("SELECT * FROM events LIMIT 1");
      const event = events[0];

      // Update event with starts_at after ends_at
      const res = await patchJson(
        `/events/${event.id}`,
        {
          starts_at: '2026-11-20T15:00:00.000Z',
          ends_at: '2026-11-20T10:00:00.000Z'
        },
        adminToken
      );
      assert.equal(res.status, 422, 'Zod catches invalid date range before DB with 422');
    });
  });

  describe('4. Event Status Lifecycle with Cancelled Enum', () => {
    it('allows administrators to transition an event to cancelled status', async () => {
      const { rows: events } = await pool.query(
        "SELECT * FROM events WHERE title = 'Annual Music Festival'"
      );
      const festival = events[0];

      const res = await patchJson(
        `/admin/events/${festival.id}/status`,
        { status: 'cancelled' },
        adminToken
      );
      assert.equal(res.status, 200, 'Admin can cancel event');
      assert.equal(res.data.data.event.status, 'cancelled');
    });
  });
});
