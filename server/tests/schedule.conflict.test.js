import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
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
  const res = await fetch(`${baseUrl}${path}`, { method: 'DELETE', headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
};

describe('Schedule Conflict & Overlapping Bookings Tests', () => {
  let student;
  let studentToken;
  let baseEventId;

  // Timestamps for a base event (e.g. tomorrow 10:00 AM - 12:00 PM)
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
  tomorrow.setMinutes(0, 0, 0);
  const baseT10 = new Date(tomorrow); baseT10.setHours(10, 0, 0, 0);
  const baseT12 = new Date(tomorrow); baseT12.setHours(12, 0, 0, 0);

  const createEvent = async (title, startsAt, endsAt, capacity = 20) => {
    const { rows } = await pool.query(`
      INSERT INTO events (organiser_id, title, description, category, venue, starts_at, ends_at, capacity, status)
      VALUES (2, $1, 'Test event description', 'Workshop', 'Room 101', $2, $3, $4, 'approved')
      RETURNING id, title, starts_at, ends_at, capacity
    `, [title, startsAt.toISOString(), endsAt.toISOString(), capacity]);
    return rows[0];
  };

  before(async () => {
    await seed();
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://localhost:${port}/api/v1`;

    // Create a dedicated student for interval tests
    const passwordHash = await bcrypt.hash('student123', 6);
    const { rows } = await pool.query(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ('Conflict Student', 'conflict_student@campuspass.edu', '${passwordHash}', 'student')
      RETURNING id, name, email, role
    `);
    student = rows[0];
    studentToken = signAccessToken(student);

    // Create base event: 10:00 AM - 12:00 PM
    const baseEvent = await createEvent('Base Morning Keynote', baseT10, baseT12, 50);
    baseEventId = baseEvent.id;

    // Student books the base event
    const bookBaseRes = await postJson(`/events/${baseEventId}/bookings`, null, studentToken);
    assert.equal(bookBaseRes.status, 201, 'Base event booking must succeed');
  });

  after(async () => {
    server.close();
  });

  // ==========================================
  // BASIC INTERVAL TESTS (1 - 10)
  // ==========================================
  describe('Basic Interval Rules', () => {
    it('1. Rejects partially overlapping events (starts during existing: 11:00 AM - 1:00 PM)', async () => {
      const t11 = new Date(tomorrow); t11.setHours(11, 0, 0, 0);
      const t13 = new Date(tomorrow); t13.setHours(13, 0, 0, 0);
      const ev = await createEvent('Overlap Late', t11, t13);

      const res = await postJson(`/events/${ev.id}/bookings`, null, studentToken);
      assert.equal(res.status, 409);
      assert.equal(res.data.error?.code || res.data.code, 'SCHEDULE_CONFLICT');
    });

    it('2. Rejects an event entirely contained within existing booking (10:30 AM - 11:00 AM)', async () => {
      const t1030 = new Date(tomorrow); t1030.setHours(10, 30, 0, 0);
      const t1100 = new Date(tomorrow); t1100.setHours(11, 0, 0, 0);
      const ev = await createEvent('Inside Interval', t1030, t1100);

      const res = await postJson(`/events/${ev.id}/bookings`, null, studentToken);
      assert.equal(res.status, 409);
      assert.equal(res.data.error?.code || res.data.code, 'SCHEDULE_CONFLICT');
    });

    it('3. Rejects an event that starts before existing booking and ends during it (9:00 AM - 10:30 AM)', async () => {
      const t09 = new Date(tomorrow); t09.setHours(9, 0, 0, 0);
      const t1030 = new Date(tomorrow); t1030.setHours(10, 30, 0, 0);
      const ev = await createEvent('Overlap Early', t09, t1030);

      const res = await postJson(`/events/${ev.id}/bookings`, null, studentToken);
      assert.equal(res.status, 409);
      assert.equal(res.data.error?.code || res.data.code, 'SCHEDULE_CONFLICT');
    });

    it('4. Allows events that meet exactly at existing event’s end time (12:00 PM - 1:00 PM)', async () => {
      const t12 = new Date(tomorrow); t12.setHours(12, 0, 0, 0);
      const t13 = new Date(tomorrow); t13.setHours(13, 0, 0, 0);
      const ev = await createEvent('Adjacent End Meet', t12, t13);

      const res = await postJson(`/events/${ev.id}/bookings`, null, studentToken);
      assert.equal(res.status, 201, 'Adjacent meeting at end point must be allowed');
      assert.equal(res.data.data.booking.status, 'booked');
    });

    it('5. Allows events that end exactly at existing event’s start time (9:00 AM - 10:00 AM)', async () => {
      const t09 = new Date(tomorrow); t09.setHours(9, 0, 0, 0);
      const t10 = new Date(tomorrow); t10.setHours(10, 0, 0, 0);
      const ev = await createEvent('Adjacent Start Meet', t09, t10);

      const res = await postJson(`/events/${ev.id}/bookings`, null, studentToken);
      assert.equal(res.status, 201, 'Adjacent meeting at start point must be allowed');
      assert.equal(res.data.data.booking.status, 'booked');
    });

    it('6. Allows separate non-overlapping events on the same day (2:00 PM - 4:00 PM)', async () => {
      const t14 = new Date(tomorrow); t14.setHours(14, 0, 0, 0);
      const t16 = new Date(tomorrow); t16.setHours(16, 0, 0, 0);
      const ev = await createEvent('Afternoon Workshop', t14, t16);

      const res = await postJson(`/events/${ev.id}/bookings`, null, studentToken);
      assert.equal(res.status, 201);
    });

    it('7. Allows an event on another day (Day after tomorrow 10:00 AM - 12:00 PM)', async () => {
      const nextDay = new Date(tomorrow.getTime() + 24 * 3600 * 1000);
      const t10Next = new Date(nextDay); t10Next.setHours(10, 0, 0, 0);
      const t12Next = new Date(nextDay); t12Next.setHours(12, 0, 0, 0);
      const ev = await createEvent('Next Day Keynote', t10Next, t12Next);

      const res = await postJson(`/events/${ev.id}/bookings`, null, studentToken);
      assert.equal(res.status, 201);
    });

    it('8. Ignores cancelled bookings when checking conflicts', async () => {
      // Create temporary event from 5:00 PM to 7:00 PM
      const t17 = new Date(tomorrow); t17.setHours(17, 0, 0, 0);
      const t19 = new Date(tomorrow); t19.setHours(19, 0, 0, 0);
      const evA = await createEvent('Evening Session A', t17, t19);

      // Book and then cancel Event A
      const bookRes = await postJson(`/events/${evA.id}/bookings`, null, studentToken);
      assert.equal(bookRes.status, 201);
      const bookingId = bookRes.data.data.booking.id;

      const cancelRes = await deleteJson(`/bookings/${bookingId}`, studentToken);
      assert.equal(cancelRes.status, 200);

      // Now create Event B that overlaps Event A (5:30 PM - 6:30 PM)
      const t1730 = new Date(tomorrow); t1730.setHours(17, 30, 0, 0);
      const t1830 = new Date(tomorrow); t1830.setHours(18, 30, 0, 0);
      const evB = await createEvent('Evening Session B', t1730, t1830);

      // Booking Event B must SUCCEED because Event A was cancelled
      const bookBRes = await postJson(`/events/${evB.id}/bookings`, null, studentToken);
      assert.equal(bookBRes.status, 201, 'Cancelled booking must not block overlapping new booking');
    });

    it('9 & 10. Rejects conflict even when target event has plenty of seats and creates no booking record', async () => {
      // Event with 500 capacity overlapping Base Event (11:00 AM - 11:30 AM)
      const t1100 = new Date(tomorrow); t1100.setHours(11, 0, 0, 0);
      const t1130 = new Date(tomorrow); t1130.setHours(11, 30, 0, 0);
      const hugeEv = await createEvent('Huge Arena Event', t1100, t1130, 500);

      const res = await postJson(`/events/${hugeEv.id}/bookings`, null, studentToken);
      assert.equal(res.status, 409);
      assert.equal(res.data.error?.code || res.data.code, 'SCHEDULE_CONFLICT');

      // Verify no booking was inserted into PostgreSQL
      const { rows } = await pool.query(
        "SELECT id FROM bookings WHERE event_id = $1 AND user_id = $2",
        [hugeEv.id, student.id]
      );
      assert.equal(rows.length, 0, 'No booking record must be created for failed request');
    });
  });

  // ==========================================
  // CONCURRENT OVERLAP BOOKING TESTS
  // ==========================================
  describe('Concurrent Overlap Booking Serialization', () => {
    it('1, 2 & 3. Fires simultaneous booking requests for two overlapping events for the same student: at most 1 succeeds', async () => {
      // Create student David
      const passwordHash = await bcrypt.hash('student123', 6);
      const { rows: uRows } = await pool.query(`
        INSERT INTO users (name, email, password_hash, role)
        VALUES ('David Conflict', 'david_conflict@campuspass.edu', '${passwordHash}', 'student')
        RETURNING id, name, email, role
      `);
      const david = uRows[0];
      const davidToken = signAccessToken(david);

      // Create two mutually overlapping events in future:
      // Event X: 3 days ahead, 10:00 - 12:00
      // Event Y: 3 days ahead, 11:00 - 13:00
      const day3 = new Date(Date.now() + 3 * 24 * 3600 * 1000);
      day3.setMinutes(0, 0, 0);
      const evX_start = new Date(day3); evX_start.setHours(10, 0, 0, 0);
      const evX_end = new Date(day3); evX_end.setHours(12, 0, 0, 0);
      const evY_start = new Date(day3); evY_start.setHours(11, 0, 0, 0);
      const evY_end = new Date(day3); evY_end.setHours(13, 0, 0, 0);

      const evX = await createEvent('Concurrent Event X', evX_start, evX_end, 10);
      const evY = await createEvent('Concurrent Event Y', evY_start, evY_end, 10);

      // Fire simultaneous requests from David for both Event X and Event Y
      const [resX, resY] = await Promise.all([
        postJson(`/events/${evX.id}/bookings`, null, davidToken),
        postJson(`/events/${evY.id}/bookings`, null, davidToken)
      ]);

      const successes = [resX, resY].filter((r) => r.status === 201);
      const conflicts = [resX, resY].filter(
        (r) => r.status === 409 && (r.data.error?.code === 'SCHEDULE_CONFLICT' || r.data.code === 'SCHEDULE_CONFLICT')
      );

      console.log(`Concurrent overlapping result: ${successes.length} succeeded, ${conflicts.length} rejected with SCHEDULE_CONFLICT`);

      assert.equal(successes.length, 1, 'Exactly one of the overlapping bookings must succeed');
      assert.equal(conflicts.length, 1, 'The other concurrent overlapping request must be rejected with SCHEDULE_CONFLICT');

      // Verify DB state: exactly 1 active booking for David between Event X and Event Y
      const { rows: dbRows } = await pool.query(
        "SELECT id, event_id FROM bookings WHERE user_id = $1 AND event_id IN ($2, $3) AND status = 'booked'",
        [david.id, evX.id, evY.id]
      );
      assert.equal(dbRows.length, 1, 'Database must have exactly 1 active booking, never both overlapping');
    });

    it('4. Simultaneous requests for non-overlapping events by same student can both succeed', async () => {
      // Create student Emma
      const passwordHash = await bcrypt.hash('student123', 6);
      const { rows: uRows } = await pool.query(`
        INSERT INTO users (name, email, password_hash, role)
        VALUES ('Emma NonConflict', 'emma_nonconflict@campuspass.edu', '${passwordHash}', 'student')
        RETURNING id, name, email, role
      `);
      const emma = uRows[0];
      const emmaToken = signAccessToken(emma);

      // Two non-overlapping events on day 4:
      // Morning: 9:00 - 11:00
      // Afternoon: 14:00 - 16:00
      const day4 = new Date(Date.now() + 4 * 24 * 3600 * 1000);
      day4.setMinutes(0, 0, 0);
      const ev1_start = new Date(day4); ev1_start.setHours(9, 0, 0, 0);
      const ev1_end = new Date(day4); ev1_end.setHours(11, 0, 0, 0);
      const ev2_start = new Date(day4); ev2_start.setHours(14, 0, 0, 0);
      const ev2_end = new Date(day4); ev2_end.setHours(16, 0, 0, 0);

      const ev1 = await createEvent('Emma Morning Session', ev1_start, ev1_end, 10);
      const ev2 = await createEvent('Emma Afternoon Session', ev2_start, ev2_end, 10);

      const [res1, res2] = await Promise.all([
        postJson(`/events/${ev1.id}/bookings`, null, emmaToken),
        postJson(`/events/${ev2.id}/bookings`, null, emmaToken)
      ]);

      assert.equal(res1.status, 201, 'Non-overlapping Event 1 must succeed');
      assert.equal(res2.status, 201, 'Non-overlapping Event 2 must succeed');

      const { rows: dbRows } = await pool.query(
        "SELECT id FROM bookings WHERE user_id = $1 AND status = 'booked' AND event_id IN ($2, $3)",
        [emma.id, ev1.id, ev2.id]
      );
      assert.equal(dbRows.length, 2, 'Both non-overlapping events must be successfully booked');
    });

    it('5. Different students can book the same event independently without blocking each other', async () => {
      // Create student Frank & George
      const passwordHash = await bcrypt.hash('student123', 6);
      const { rows: fRows } = await pool.query(`
        INSERT INTO users (name, email, password_hash, role)
        VALUES ('Frank Student', 'frank@campuspass.edu', '${passwordHash}', 'student')
        RETURNING id, name, email, role
      `);
      const { rows: gRows } = await pool.query(`
        INSERT INTO users (name, email, password_hash, role)
        VALUES ('George Student', 'george@campuspass.edu', '${passwordHash}', 'student')
        RETURNING id, name, email, role
      `);

      const frankToken = signAccessToken(fRows[0]);
      const georgeToken = signAccessToken(gRows[0]);

      // Shared event
      const day5 = new Date(Date.now() + 5 * 24 * 3600 * 1000);
      const sStart = new Date(day5); sStart.setHours(10, 0, 0, 0);
      const sEnd = new Date(day5); sEnd.setHours(12, 0, 0, 0);
      const sharedEv = await createEvent('Shared Event for Two', sStart, sEnd, 10);

      const [resF, resG] = await Promise.all([
        postJson(`/events/${sharedEv.id}/bookings`, null, frankToken),
        postJson(`/events/${sharedEv.id}/bookings`, null, georgeToken)
      ]);

      assert.equal(resF.status, 201, 'Frank booking must succeed');
      assert.equal(resG.status, 201, 'George booking must succeed');
    });
  });
});
