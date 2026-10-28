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
  return { status: res.status, headers: res.headers, data };
};

const getJson = async (path, token) => {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, { headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, headers: res.headers, data };
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
  return { status: res.status, headers: res.headers, data };
};

const deleteJson = async (path, token) => {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, { method: 'DELETE', headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, headers: res.headers, data };
};

describe('Phase 8 — Complete End-to-End & Deployment Verification', () => {
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

  describe('1. Health Check & Core Services Live Status', () => {
    it('GET /health returns 200 OK with connected database and redis statuses', async () => {
      const res = await getJson('/health');
      assert.equal(res.status, 200);
      assert.equal(res.data.status, 'ok');
      assert.equal(res.data.services.database, 'ok');
      assert.equal(res.data.services.redis, 'ok');
      assert.ok(res.data.timestamp);
    });
  });

  describe('2. Student End-to-End Journey', () => {
    let newStudentToken;
    let freshEmail;
    let bookedEventId;
    let createdBookingId;

    it('registers new student and returns JWT access token', async () => {
      freshEmail = `e2e_student_${Date.now()}@student.campuspass.edu`;
      const regRes = await postJson('/auth/register', {
        name: 'E2E Test Student',
        email: freshEmail,
        password: 'password123'
      });
      assert.equal(regRes.status, 201);
      assert.ok(regRes.data.data.accessToken);
      assert.equal(regRes.data.data.user.role, 'student');
      newStudentToken = regRes.data.data.accessToken;
    });

    it('logs in successfully with registered credentials', async () => {
      const loginRes = await postJson('/auth/login', {
        email: freshEmail,
        password: 'password123'
      });
      assert.equal(loginRes.status, 200);
      assert.ok(loginRes.data.data.accessToken);
    });

    it('browses events and opens event details', async () => {
      const listRes = await getJson('/events');
      assert.equal(listRes.status, 200);
      assert.ok(Array.isArray(listRes.data.data.events));
      assert.ok(listRes.data.data.events.length > 0);

      const target = listRes.data.data.events.find(
        (e) => e.title === 'AI & Robotics Workshop'
      );
      assert.ok(target, 'AI & Robotics Workshop should exist');
      bookedEventId = target.id;

      const detailRes = await getJson(`/events/${bookedEventId}`, newStudentToken);
      assert.equal(detailRes.status, 200);
      assert.equal(detailRes.data.data.event.id, bookedEventId);
      assert.equal(detailRes.data.data.event.hasBooked, false);
    });

    it('books seat, receives booking record, and receives confirmation notification', async () => {
      const bookRes = await postJson(`/events/${bookedEventId}/bookings`, {}, newStudentToken);
      assert.equal(bookRes.status, 201);
      createdBookingId = bookRes.data.data.booking.id;

      // Verify notification created
      const notifRes = await getJson('/notifications', newStudentToken);
      assert.equal(notifRes.status, 200);
      const confirmedNotif = notifRes.data.data.notifications.find(
        (n) => n.type === 'booking_confirmed' && String(n.booking_id) === String(createdBookingId)
      );
      assert.ok(confirmedNotif, 'Should receive booking_confirmed notification');
      assert.equal(confirmedNotif.is_read, false);

      // Mark notification as read
      const markRes = await patchJson(`/notifications/${confirmedNotif.id}/read`, {}, newStudentToken);
      assert.equal(markRes.status, 200);
      assert.equal(markRes.data.data.notification.is_read, true);
    });

    it('rejects attempt to book overlapping event with SCHEDULE_CONFLICT', async () => {
      // Find the booked event times
      const { rows } = await pool.query('SELECT starts_at, ends_at FROM events WHERE id = $1', [bookedEventId]);
      const bookedEvent = rows[0];

      // Create a temporary overlapping event
      const overlapStarts = new Date(new Date(bookedEvent.starts_at).getTime() + 30 * 60 * 1000).toISOString();
      const overlapEnds = new Date(new Date(bookedEvent.ends_at).getTime() + 60 * 60 * 1000).toISOString();

      const { rows: evRows } = await pool.query(
        `INSERT INTO events (organiser_id, title, description, category, venue, starts_at, ends_at, capacity, status)
         VALUES ($1, 'Overlapping Seminar', 'Conflict test', 'Tech', 'Hall B', $2, $3, 30, 'approved')
         RETURNING id`,
        [organiser.id, overlapStarts, overlapEnds]
      );
      const overlapEventId = evRows[0].id;

      const conflictRes = await postJson(`/events/${overlapEventId}/bookings`, {}, newStudentToken);
      assert.equal(conflictRes.status, 409);
      assert.equal(conflictRes.data.code, 'SCHEDULE_CONFLICT');
    });

    it('exports RFC 5545 compliant .ics calendar file', async () => {
      const icsRes = await fetch(`${baseUrl}/events/${bookedEventId}/calendar.ics`);
      assert.equal(icsRes.status, 200);
      assert.match(icsRes.headers.get('content-type'), /text\/calendar/);
      const text = await icsRes.text();
      assert.match(text, /BEGIN:VCALENDAR/);
      assert.match(text, /BEGIN:VEVENT/);
      assert.match(text, /END:VEVENT/);
      assert.match(text, /END:VCALENDAR/);
    });

    it('cancels booking and receives booking_cancelled notification', async () => {
      const cancelRes = await deleteJson(`/bookings/${createdBookingId}`, newStudentToken);
      assert.equal(cancelRes.status, 200);
      assert.equal(cancelRes.data.data.booking.status, 'cancelled');

      const notifRes = await getJson('/notifications', newStudentToken);
      const cancelNotif = notifRes.data.data.notifications.find(
        (n) => n.type === 'booking_cancelled' && String(n.booking_id) === String(createdBookingId)
      );
      assert.ok(cancelNotif, 'Should receive booking_cancelled notification');
    });
  });

  describe('3. Organiser & Admin Workflows', () => {
    let newEventId;

    it('organiser creates pending event and it is hidden from public browse list', async () => {
      const startsAt = new Date(Date.now() + 100 * 60 * 60 * 1000).toISOString();
      const endsAt = new Date(Date.now() + 104 * 60 * 60 * 1000).toISOString();

      const createRes = await postJson(
        '/events',
        {
          title: 'Quantum Computing Colloquium',
          description: 'Deep dive into qubits and quantum circuits',
          category: 'Technology',
          venue: 'Physics Hall 101',
          starts_at: startsAt,
          ends_at: endsAt,
          capacity: 25
        },
        organiserToken
      );
      assert.equal(createRes.status, 201);
      assert.equal(createRes.data.data.event.status, 'pending');
      newEventId = createRes.data.data.event.id;

      // Hidden from public list
      const publicList = await getJson('/events');
      const found = publicList.data.data.events.find((e) => String(e.id) === String(newEventId));
      assert.equal(found, undefined);
    });

    it('admin approves pending event; event becomes publicly visible', async () => {
      const approveRes = await patchJson(
        `/admin/events/${newEventId}/status`,
        { status: 'approved' },
        adminToken
      );
      assert.equal(approveRes.status, 200);
      assert.equal(approveRes.data.data.event.status, 'approved');

      // Now publicly visible
      const publicList = await getJson('/events');
      const found = publicList.data.data.events.find((e) => String(e.id) === String(newEventId));
      assert.ok(found, 'Approved event must be visible in public catalog');
    });

    it('student books seat; organiser cannot reduce capacity below active bookings', async () => {
      const bookRes = await postJson(`/events/${newEventId}/bookings`, {}, aliceToken);
      assert.equal(bookRes.status, 201);

      // Attempt to reduce capacity to 0
      const reduceRes = await patchJson(
        `/events/${newEventId}`,
        { capacity: 0 },
        organiserToken
      );
      assert.equal(reduceRes.status, 422, 'Zod blocks non-positive capacity with 422');

      // Organiser inspects attendee roster
      const rosterRes = await getJson(`/events/${newEventId}/bookings`, organiserToken);
      assert.equal(rosterRes.status, 200);
      assert.ok(Array.isArray(rosterRes.data.data.attendees));
      assert.equal(rosterRes.data.data.attendees.length, 1);
      assert.equal(rosterRes.data.data.attendees[0].user_name, 'Alice Smith');
    });

    it('admin cannot remove their own admin role (self-demotion protection)', async () => {
      const demoteRes = await patchJson(
        `/admin/users/${admin.id}/role`,
        { role: 'student' },
        adminToken
      );
      assert.equal(demoteRes.status, 403);
      assert.equal(demoteRes.data.code, 'SELF_DEMOTION_PROHIBITED');
    });
  });

  describe('4. Concurrency Integrity & Boundary Tests', () => {
    it('serializes concurrent cancellations; exactly 1 succeeds and duplicates get 400 ALREADY_CANCELLED', async () => {
      // Find an event far in the future
      const { rows: events } = await pool.query(
        "SELECT * FROM events WHERE title = 'Annual Music Festival'"
      );
      const festival = events[0];

      // Bob books the festival
      const bookRes = await postJson(`/events/${festival.id}/bookings`, {}, bobToken);
      assert.equal(bookRes.status, 201);
      const bookingId = bookRes.data.data.booking.id;

      // 5 concurrent cancellation requests
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

      assert.equal(successCount, 1, 'Exactly 1 concurrent cancellation must succeed');
      assert.equal(alreadyCancelledCount, 4, 'Remaining concurrent requests must get ALREADY_CANCELLED');
    });
  });
});
