import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { app } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { seed } from '../src/db/seed.js';
import { signAccessToken } from '../src/utils/tokens.js';

let server;
let baseUrl;

describe('Booking Concurrency & Capacity Test', () => {
  const TOTAL_STUDENTS = 20;
  const CAPACITY = 5;
  const studentTokens = [];
  let eventId;

  before(async () => {
    await seed();
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://localhost:${port}/api/v1`;

    // Create an exclusive event with capacity 5 starting in 24 hours
    const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const endsAt = new Date(Date.now() + 28 * 60 * 60 * 1000).toISOString();

    const evRes = await pool.query(`
      INSERT INTO events (organiser_id, title, description, category, venue, starts_at, ends_at, capacity, status)
      VALUES (2, 'High Contention Workshop', 'Limited capacity test', 'Tech', 'Hall 1', '${startsAt}', '${endsAt}', ${CAPACITY}, 'approved')
      RETURNING id
    `);
    eventId = evRes.rows[0].id;

    // Create 20 distinct student users in DB
    const passwordHash = await bcrypt.hash('studentpass123', 6);
    for (let i = 1; i <= TOTAL_STUDENTS; i++) {
      const email = `concurrent_student_${i}@campuspass.edu`;
      const { rows } = await pool.query(
        `INSERT INTO users (name, email, password_hash, role)
         VALUES ($1, $2, $3, 'student')
         RETURNING id, name, email, role`,
        [`Student ${i}`, email, passwordHash]
      );
      studentTokens.push(signAccessToken(rows[0]));
    }
  });

  after(async () => {
    server.close();
  });

  it('Fires 20 concurrent booking requests at a 5-seat event: exactly 5 succeed, 15 get EVENT_FULL', async () => {
    // Fire all 20 booking attempts in parallel
    const bookingPromises = studentTokens.map(async (token) => {
      const res = await fetch(`${baseUrl}/events/${eventId}/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, data };
    });

    const results = await Promise.all(bookingPromises);

    const successful = results.filter((r) => r.status === 201);
    const full = results.filter((r) => r.status === 409 && r.data.code === 'EVENT_FULL');

    console.log(`Concurrency test result: ${successful.length} succeeded, ${full.length} failed with EVENT_FULL`);

    assert.equal(successful.length, CAPACITY, `Expected exactly ${CAPACITY} successful bookings`);
    assert.equal(full.length, TOTAL_STUDENTS - CAPACITY, `Expected ${TOTAL_STUDENTS - CAPACITY} rejections with EVENT_FULL`);

    // Verify DB count
    const { rows } = await pool.query(
      "SELECT COUNT(*)::int AS count FROM bookings WHERE event_id = $1 AND status = 'booked'",
      [eventId]
    );
    assert.equal(rows[0].count, CAPACITY, `Database must contain exactly ${CAPACITY} active bookings`);
  });

  it('Fires 5 concurrent duplicate booking requests by the same student: exactly 1 succeeds, 4 get ALREADY_BOOKED', async () => {
    // Create a new event with plenty of seats
    const startsAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const endsAt = new Date(Date.now() + 52 * 60 * 60 * 1000).toISOString();

    const evRes = await pool.query(`
      INSERT INTO events (organiser_id, title, description, category, venue, starts_at, ends_at, capacity, status)
      VALUES (2, 'Duplicate Test Seminar', 'Testing duplicate seat booking', 'Tech', 'Hall 2', '${startsAt}', '${endsAt}', 50, 'approved')
      RETURNING id
    `);
    const duplicateEventId = evRes.rows[0].id;

    // Use student 1's token for 5 simultaneous requests
    const studentToken = studentTokens[0];

    const attempts = Array.from({ length: 5 }).map(async () => {
      const res = await fetch(`${baseUrl}/events/${duplicateEventId}/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${studentToken}`
        }
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, data };
    });

    const results = await Promise.all(attempts);

    const successful = results.filter((r) => r.status === 201);
    const alreadyBooked = results.filter((r) => r.status === 409 && (r.data.code === 'ALREADY_BOOKED' || r.data.error?.code === 'ALREADY_BOOKED'));

    console.log(`Duplicate concurrency test result: ${successful.length} succeeded, ${alreadyBooked.length} failed with ALREADY_BOOKED`);

    assert.equal(successful.length, 1, 'Expected exactly 1 booking to succeed for the same student');
    assert.equal(alreadyBooked.length, 4, 'Expected exactly 4 duplicate attempts to be rejected with ALREADY_BOOKED');

    // Verify exactly 1 booking row in DB
    const { rows } = await pool.query(
      "SELECT COUNT(*)::int AS count FROM bookings WHERE event_id = $1 AND status = 'booked'",
      [duplicateEventId]
    );
    assert.equal(rows[0].count, 1, 'Database must contain exactly 1 active booking for this student and event');
  });
});
