import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { seed } from '../src/db/seed.js';

let server;
let baseUrl;

const postJson = async (path, body, token, cookie) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (cookie) headers['Cookie'] = cookie;
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const cookieHeader = res.headers.get('set-cookie');
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, cookie: cookieHeader };
};

const getJson = async (path, token, cookie) => {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (cookie) headers['Cookie'] = cookie;
  const res = await fetch(`${baseUrl}${path}`, { headers });
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
  const res = await fetch(`${baseUrl}${path}`, { method: 'DELETE', headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
};

describe('End-to-End User Journeys Verification', () => {
  before(async () => {
    await seed();
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://localhost:${port}/api/v1`;
  });

  after(async () => {
    server.close();
  });

  // ==========================================
  // JOURNEY A: VISITOR
  // ==========================================
  describe('Journey A: Visitor', () => {
    it('1 & 2. Browse approved upcoming events without logging in', async () => {
      const res = await getJson('/events');
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.data.data.events));
      assert.ok(res.data.data.events.length > 0);
      for (const ev of res.data.data.events) {
        assert.equal(ev.status, 'approved');
      }
    });

    it('3. Search by event title and filter by category', async () => {
      // Search 'Hackathon'
      const searchRes = await getJson('/events?search=Hackathon');
      assert.equal(searchRes.status, 200);
      assert.ok(searchRes.data.data.events.some((e) => e.title.includes('Hackathon')));

      // Filter category 'Music'
      const catRes = await getJson('/events?category=Music');
      assert.equal(catRes.status, 200);
      for (const ev of catRes.data.data.events) {
        assert.equal(ev.category, 'Music');
      }
    });

    it('4. Open event detail page', async () => {
      const res = await getJson('/events/1');
      assert.equal(res.status, 200);
      assert.equal(res.data.data.event.id, '1');
      assert.ok(res.data.data.event.seats_left >= 0);
    });

    it('5. Verify pending and rejected events are not publicly exposed', async () => {
      // Event 5 was seeded as 'pending'
      const listRes = await getJson('/events');
      const foundPendingInList = listRes.data.data.events.find((e) => e.id === 5 || e.id === '5');
      assert.equal(foundPendingInList, undefined, 'Pending event must not appear in public listing');

      // Attempting to directly fetch detail of pending event as visitor should return 404
      const detailRes = await getJson('/events/5');
      assert.equal(detailRes.status, 404);
    });
  });

  // ==========================================
  // JOURNEY B: STUDENT
  // ==========================================
  describe('Journey B: Student', () => {
    let studentToken;
    let refreshCookie;
    const testEmail = `journey_student_${Date.now()}@campuspass.edu`;

    it('1. Register a new student account', async () => {
      const res = await postJson('/auth/register', {
        name: 'Journey Student',
        email: testEmail,
        password: 'securePassword123'
      });
      assert.equal(res.status, 201);
      assert.equal(res.data.data.user.role, 'student');
      assert.ok(res.data.data.accessToken);
      assert.ok(res.cookie);
    });

    it('2 & 3. Login with credentials and verify invalid credentials rejection', async () => {
      // Invalid credentials
      const invalidRes = await postJson('/auth/login', {
        email: testEmail,
        password: 'wrongpassword'
      });
      assert.equal(invalidRes.status, 401);

      // Valid credentials
      const validRes = await postJson('/auth/login', {
        email: testEmail,
        password: 'securePassword123'
      });
      assert.equal(validRes.status, 200);
      studentToken = validRes.data.data.accessToken;
      refreshCookie = validRes.cookie;
      assert.ok(studentToken);
    });

    it('4. Refresh session using refresh token cookie (session restoration)', async () => {
      const res = await postJson('/auth/refresh', null, null, refreshCookie);
      assert.equal(res.status, 200);
      assert.ok(res.data.data.accessToken);
      studentToken = res.data.data.accessToken;
      if (res.cookie) refreshCookie = res.cookie;
    });

    let bookedEventId = 2; // Annual Music Festival
    let bookingId;

    it('5 & 6 & 7. Browse events, inspect seats remaining, and book an available seat', async () => {
      const detailBefore = await getJson(`/events/${bookedEventId}`);
      const seatsBefore = detailBefore.data.data.event.seats_left;

      const bookRes = await postJson(`/events/${bookedEventId}/bookings`, null, studentToken);
      assert.equal(bookRes.status, 201);
      bookingId = bookRes.data.data.booking.id;

      // Verify persisted in PostgreSQL
      const { rows } = await pool.query('SELECT * FROM bookings WHERE id = $1', [bookingId]);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].status, 'booked');

      // Verify seats remaining decremented
      const detailAfter = await getJson(`/events/${bookedEventId}`);
      assert.equal(detailAfter.data.data.event.seats_left, seatsBefore - 1);
    });

    it('8. Open My Bookings and confirm booking appears', async () => {
      const res = await getJson('/me/bookings', studentToken);
      assert.equal(res.status, 200);
      const found = res.data.data.bookings.find((b) => String(b.id) === String(bookingId));
      assert.ok(found);
      assert.equal(found.status, 'booked');
    });

    it('9. Attempt duplicate booking for same event and verify rejection', async () => {
      const dupRes = await postJson(`/events/${bookedEventId}/bookings`, null, studentToken);
      assert.equal(dupRes.status, 409);
      assert.equal(dupRes.data.code, 'ALREADY_BOOKED');
    });

    it('10 & 11. Cancel a permitted booking and verify seat becomes available', async () => {
      const detailBefore = await getJson(`/events/${bookedEventId}`);
      const seatsBefore = detailBefore.data.data.event.seats_left;

      const cancelRes = await deleteJson(`/bookings/${bookingId}`, studentToken);
      assert.equal(cancelRes.status, 200);
      assert.equal(cancelRes.data.data.booking.status, 'cancelled');

      // Seat re-claimed
      const detailAfter = await getJson(`/events/${bookedEventId}`);
      assert.equal(detailAfter.data.data.event.seats_left, seatsBefore + 1);
    });

    it('12. Verify the two-hour cancellation cutoff', async () => {
      // Create event starting in 30 minutes
      const startsAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const endsAt = new Date(Date.now() + 120 * 60 * 1000).toISOString();
      const evRes = await pool.query(`
        INSERT INTO events (organiser_id, title, description, category, venue, starts_at, ends_at, capacity, status)
        VALUES (2, 'Starting Imminently', 'Quick event', 'Tech', 'Room 10', '${startsAt}', '${endsAt}', 20, 'approved')
        RETURNING id
      `);
      const immEventId = evRes.rows[0].id;

      // Book it
      const bookRes = await postJson(`/events/${immEventId}/bookings`, null, studentToken);
      assert.equal(bookRes.status, 201);
      const immBookingId = bookRes.data.data.booking.id;

      // Try cancel
      const cancelRes = await deleteJson(`/bookings/${immBookingId}`, studentToken);
      assert.equal(cancelRes.status, 409);
      assert.equal(cancelRes.data.code, 'CANCEL_WINDOW_CLOSED');
    });
  });

  // ==========================================
  // JOURNEY C: ORGANISER
  // ==========================================
  describe('Journey C: Organiser', () => {
    let organiserToken;
    let createdEventId;

    before(async () => {
      const loginRes = await postJson('/auth/login', {
        email: 'organiser@campuspass.edu',
        password: 'organiser123'
      });
      organiserToken = loginRes.data.data.accessToken;
    });

    it('1 & 2. Log in and view owned events', async () => {
      const res = await getJson('/me/events', organiserToken);
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.data.data.events));
    });

    it('3, 4 & 5. Create event, starts pending, and is not publicly visible', async () => {
      const startsAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
      const endsAt = new Date(Date.now() + 76 * 60 * 60 * 1000).toISOString();

      const createRes = await postJson(
        '/events',
        {
          title: 'Robotics Workshop 2026',
          description: 'Autonomous agents workshop',
          category: 'Technology',
          venue: 'Lab C',
          starts_at: startsAt,
          ends_at: endsAt,
          capacity: 40
        },
        organiserToken
      );
      assert.equal(createRes.status, 201);
      assert.equal(createRes.data.data.event.status, 'pending');
      createdEventId = createRes.data.data.event.id;

      // Must NOT be visible in public events list
      const publicRes = await getJson('/events');
      const found = publicRes.data.data.events.find((e) => String(e.id) === String(createdEventId));
      assert.equal(found, undefined);
    });

    it('6. Edit an owned event', async () => {
      const editRes = await patchJson(
        `/events/${createdEventId}`,
        { venue: 'Auditorium Hall X' },
        organiserToken
      );
      assert.equal(editRes.status, 200);
      assert.equal(editRes.data.data.event.venue, 'Auditorium Hall X');
    });

    it('7. Attempt to edit another organiser’s event (403 FORBIDDEN)', async () => {
      // Create another organiser
      const { rows } = await pool.query(`
        INSERT INTO users (name, email, password_hash, role)
        VALUES ('Other Organiser', 'other_org@campuspass.edu', 'dummy', 'organiser')
        RETURNING id, name, email, role
      `);
      const { signAccessToken } = await import('../src/utils/tokens.js');
      const otherToken = signAccessToken(rows[0]);

      const res = await patchJson(
        `/events/${createdEventId}`,
        { title: 'Hacked Title' },
        otherToken
      );
      assert.equal(res.status, 403);
    });

    it('8. View attendee list for an owned event', async () => {
      // Event 1 has Alice booked in seed
      const res = await getJson('/events/1/bookings', organiserToken);
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.data.data.attendees));
      assert.ok(res.data.data.attendees.length > 0);
    });
  });

  // ==========================================
  // JOURNEY D: ADMIN
  // ==========================================
  describe('Journey D: Admin', () => {
    let adminToken;
    let pendingEventId;
    let rejectTargetId;

    before(async () => {
      const loginRes = await postJson('/auth/login', {
        email: 'admin@campuspass.edu',
        password: 'admin123'
      });
      adminToken = loginRes.data.data.accessToken;

      // Event 5 was seeded as pending
      pendingEventId = 5;

      // Create another pending event to test rejection
      const startsAt = new Date(Date.now() + 100 * 60 * 60 * 1000).toISOString();
      const endsAt = new Date(Date.now() + 104 * 60 * 60 * 1000).toISOString();
      const evRes = await pool.query(`
        INSERT INTO events (organiser_id, title, description, category, venue, starts_at, ends_at, capacity, status)
        VALUES (2, 'Unapproved Gathering', 'Will be rejected', 'Social', 'Quad', '${startsAt}', '${endsAt}', 50, 'pending')
        RETURNING id
      `);
      rejectTargetId = evRes.rows[0].id;
    });

    it('1 & 2. Log in and view pending events', async () => {
      const res = await getJson('/admin/events?status=pending', adminToken);
      assert.equal(res.status, 200);
      assert.ok(res.data.data.events.some((e) => String(e.id) === String(pendingEventId)));
    });

    it('3 & 4. Approve an event and verify it becomes publicly visible', async () => {
      const approveRes = await patchJson(
        `/admin/events/${pendingEventId}/status`,
        { status: 'approved' },
        adminToken
      );
      assert.equal(approveRes.status, 200);
      assert.equal(approveRes.data.data.event.status, 'approved');

      // Now visible in public listing
      const publicRes = await getJson('/events');
      const found = publicRes.data.data.events.find((e) => String(e.id) === String(pendingEventId));
      assert.ok(found, 'Approved event must appear in public listing');
    });

    it('5 & 6. Reject another pending event and verify it remains hidden', async () => {
      const rejectRes = await patchJson(
        `/admin/events/${rejectTargetId}/status`,
        { status: 'rejected' },
        adminToken
      );
      assert.equal(rejectRes.status, 200);
      assert.equal(rejectRes.data.data.event.status, 'rejected');

      const publicRes = await getJson('/events');
      const found = publicRes.data.data.events.find((e) => String(e.id) === String(rejectTargetId));
      assert.equal(found, undefined, 'Rejected event must not appear in public listing');
    });

    it('7 & 8. Change a user role and verify updated role is enforced', async () => {
      // Bob is a student (id = 4). Promote Bob to organiser.
      const roleRes = await patchJson('/admin/users/4/role', { role: 'organiser' }, adminToken);
      assert.equal(roleRes.status, 200);
      assert.equal(roleRes.data.data.user.role, 'organiser');

      // Log in as Bob and verify Bob can now create events
      const bobLogin = await postJson('/auth/login', {
        email: 'bob@student.campuspass.edu',
        password: 'password123'
      });
      const bobToken = bobLogin.data.data.accessToken;

      const startsAt = new Date(Date.now() + 120 * 60 * 60 * 1000).toISOString();
      const endsAt = new Date(Date.now() + 124 * 60 * 60 * 1000).toISOString();
      const createRes = await postJson(
        '/events',
        {
          title: "Bob's Organised Symposium",
          description: 'Created by newly promoted organiser',
          category: 'Career',
          venue: 'Room 202',
          starts_at: startsAt,
          ends_at: endsAt,
          capacity: 25
        },
        bobToken
      );
      assert.equal(createRes.status, 201);
    });
  });

  // ==========================================
  // JOURNEY E: REVIEWS
  // ==========================================
  describe('Journey E: Reviews', () => {
    let studentToken;
    let nonBookedStudentToken;
    const pastEventId = 6; // Spring Welcome Concert (seeded in past, ended 4 days ago)
    const futureEventId = 1; // Hackathon (starts in future)

    before(async () => {
      // Alice booked past event 6 and already reviewed it in seed
      // Create Student Charlie who booked past event 6 but hasn't reviewed it yet
      const charlieLogin = await postJson('/auth/login', {
        email: 'charlie@student.campuspass.edu',
        password: 'password123'
      });
      studentToken = charlieLogin.data.data.accessToken;

      // Insert booking for Charlie on past event 6
      const { rows } = await pool.query("SELECT id FROM users WHERE email = 'charlie@student.campuspass.edu'");
      const charlieId = rows[0].id;
      await pool.query(`
        INSERT INTO bookings (event_id, user_id, status)
        VALUES (${pastEventId}, ${charlieId}, 'booked')
        ON CONFLICT DO NOTHING
      `);

      // Create a student who NEVER booked event 6
      const { rows: unbookedRows } = await pool.query(`
        INSERT INTO users (name, email, password_hash, role)
        VALUES ('Unbooked Dan', 'dan@student.campuspass.edu', 'dummy', 'student')
        RETURNING id, name, email, role
      `);
      const { signAccessToken } = await import('../src/utils/tokens.js');
      nonBookedStudentToken = signAccessToken(unbookedRows[0]);
    });

    it('1. Student without an eligible booking cannot review an event (403 FORBIDDEN)', async () => {
      const res = await postJson(
        `/events/${pastEventId}/reviews`,
        { rating: 5, comment: 'I did not attend but leaving review' },
        nonBookedStudentToken
      );
      assert.equal(res.status, 403);
    });

    it('2. Student cannot review an event before it ends', async () => {
      // Future event 1
      const res = await postJson(
        `/events/${futureEventId}/reviews`,
        { rating: 5, comment: 'Cannot review future event' },
        studentToken
      );
      assert.equal(res.status, 400);
      assert.equal(res.data.code, 'EVENT_NOT_ENDED');
    });

    it('3. Eligible student who booked can review after event ends', async () => {
      const res = await postJson(
        `/events/${pastEventId}/reviews`,
        { rating: 4, comment: 'Great event! Very well organized.' },
        studentToken
      );
      assert.equal(res.status, 201);
      assert.equal(res.data.data.review.rating, 4);
    });

    it('4. Duplicate reviews are rejected (409 ALREADY_REVIEWED)', async () => {
      const dupRes = await postJson(
        `/events/${pastEventId}/reviews`,
        { rating: 3, comment: 'Trying to review again' },
        studentToken
      );
      assert.equal(dupRes.status, 409);
      assert.equal(dupRes.data.code, 'ALREADY_REVIEWED');
    });
  });
});
