import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { seed } from '../src/db/seed.js';
import { signAccessToken } from '../src/utils/tokens.js';
import notificationRepo from '../src/repositories/notificationRepo.js';

let server;
let baseUrl;

const getJson = async (path, token) => {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, { headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, headers: res.headers, data };
};

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

describe('Phase 6 — Notifications & Calendar Integration Tests', () => {
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

  describe('1. Booking Confirmation Notification', () => {
    it('generates a booking_confirmed notification when student books an event', async () => {
      // Find an approved event that Charlie or Bob hasn't booked (e.g. Design Thinking Seminar)
      const { rows: events } = await pool.query(
        "SELECT * FROM events WHERE title = 'Design Thinking & UI/UX Seminar'"
      );
      const seminar = events[0];
      assert.ok(seminar, 'Seminar event should exist');

      const bookRes = await postJson(`/events/${seminar.id}/bookings`, {}, bobToken);
      assert.equal(bookRes.status, 201);
      const bookingId = bookRes.data.data.booking.id;

      // Bob checks his notifications
      const notifRes = await getJson('/notifications', bobToken);
      assert.equal(notifRes.status, 200);
      const notifs = notifRes.data.data.notifications;

      const confirmedNotif = notifs.find(
        (n) => n.type === 'booking_confirmed' && String(n.booking_id) === String(bookingId)
      );
      assert.ok(confirmedNotif, 'Should receive booking_confirmed notification');
      assert.match(confirmedNotif.message, /Design Thinking/);
      assert.equal(confirmedNotif.is_read, false);
    });
  });

  describe('2. Booking Cancellation Notification', () => {
    it('generates a booking_cancelled notification when student cancels their booking', async () => {
      const { rows: events } = await pool.query(
        "SELECT * FROM events WHERE title = 'Design Thinking & UI/UX Seminar'"
      );
      const seminar = events[0];

      // Bob's active booking
      const { rows: bookings } = await pool.query(
        "SELECT * FROM bookings WHERE event_id = $1 AND user_id = $2 AND status = 'booked'",
        [seminar.id, bob.id]
      );
      const bobBooking = bookings[0];
      assert.ok(bobBooking, 'Bob should have an active booking');

      const cancelRes = await deleteJson(`/bookings/${bobBooking.id}`, bobToken);
      assert.equal(cancelRes.status, 200);

      // Bob checks notifications
      const notifRes = await getJson('/notifications', bobToken);
      assert.equal(notifRes.status, 200);
      const notifs = notifRes.data.data.notifications;

      const cancelNotif = notifs.find(
        (n) => n.type === 'booking_cancelled' && String(n.booking_id) === String(bobBooking.id)
      );
      assert.ok(cancelNotif, 'Should receive booking_cancelled notification');
      assert.match(cancelNotif.message, /cancelled/i);
    });
  });

  describe('3. Notification Authorization & Read States', () => {
    it('Alice can fetch her unread count and notifications, isolated from Bob', async () => {
      const unreadRes = await getJson('/notifications/unread-count', aliceToken);
      assert.equal(unreadRes.status, 200);
      assert.ok(typeof unreadRes.data.data.unreadCount === 'number');

      const aliceNotifs = await getJson('/notifications', aliceToken);
      assert.equal(aliceNotifs.status, 200);
      for (const n of aliceNotifs.data.data.notifications) {
        assert.equal(String(n.user_id), String(alice.id), "Alice should only see Alice's notifications");
      }
    });

    it('Student Alice cannot mark Bob’s notification as read (403 or 404)', async () => {
      // Find a notification belonging to Bob
      const { rows: bobNotifs } = await pool.query(
        'SELECT * FROM notifications WHERE user_id = $1 LIMIT 1',
        [bob.id]
      );
      assert.ok(bobNotifs.length > 0, "Bob should have at least one notification");
      const bobNotifId = bobNotifs[0].id;

      // Alice tries to mark Bob's notification as read
      const markRes = await patchJson(`/notifications/${bobNotifId}/read`, {}, aliceToken);
      assert.ok([403, 404].includes(markRes.status), 'Must be rejected with 403 or 404');
    });

    it('Student Alice can mark her own notification as read and mark all as read', async () => {
      // Find an unread notification for Alice
      const { rows: unreadRows } = await pool.query(
        'SELECT * FROM notifications WHERE user_id = $1 AND is_read = false LIMIT 1',
        [alice.id]
      );
      assert.ok(unreadRows.length > 0, 'Alice should have an unread notification');
      const notifId = unreadRows[0].id;

      const markRes = await patchJson(`/notifications/${notifId}/read`, {}, aliceToken);
      assert.equal(markRes.status, 200);
      assert.equal(markRes.data.data.notification.is_read, true);

      // Mark all as read
      const markAllRes = await patchJson('/notifications/read-all', {}, aliceToken);
      assert.equal(markAllRes.status, 200);

      const unreadCountAfter = await getJson('/notifications/unread-count', aliceToken);
      assert.equal(unreadCountAfter.data.data.unreadCount, 0);
    });
  });

  describe('4. Notification Deduplication / Idempotency', () => {
    it('does not duplicate notification when retry uses duplicate dedup_key', async () => {
      const dedupKey = `test_dedup_${Date.now()}`;
      const payload = {
        userId: alice.id,
        type: 'booking_confirmed',
        title: 'Idempotency Test',
        message: 'First delivery attempt',
        dedupKey
      };

      const first = await notificationRepo.createNotification(payload);
      assert.ok(first, 'First insertion should return row');

      const second = await notificationRepo.createNotification({
        ...payload,
        message: 'Second duplicate retry attempt'
      });
      assert.equal(second, null, 'Duplicate retry with same dedupKey should return null without error');

      const { rows } = await pool.query('SELECT * FROM notifications WHERE dedup_key = $1', [dedupKey]);
      assert.equal(rows.length, 1, 'Only exactly 1 row must exist in the database');
    });
  });

  describe('5. Event Update & Cancellation Notifications', () => {
    it('notifies booked attendees when organiser changes event schedule or venue', async () => {
      // Alice is booked for Campus Hackathon 2026
      const { rows: events } = await pool.query(
        "SELECT * FROM events WHERE title = 'Campus Hackathon 2026'"
      );
      const hackathon = events[0];

      const newVenue = 'Engineering Building, Advanced VR Room 402';
      const updateRes = await patchJson(
        `/events/${hackathon.id}`,
        { venue: newVenue },
        organiserToken
      );
      assert.equal(updateRes.status, 200);

      // Alice should have an event_updated notification
      const aliceNotifs = await getJson('/notifications', aliceToken);
      assert.equal(aliceNotifs.status, 200);

      const updateNotif = aliceNotifs.data.data.notifications.find(
        (n) => n.type === 'event_updated' && String(n.event_id) === String(hackathon.id)
      );
      assert.ok(updateNotif, 'Booked student should receive event_updated notification');
      assert.match(updateNotif.message, /Advanced VR Room 402/);
    });

    it('notifies booked attendees when admin cancels/rejects an event', async () => {
      const { rows: events } = await pool.query(
        "SELECT * FROM events WHERE title = 'Campus Hackathon 2026'"
      );
      const hackathon = events[0];

      const statusRes = await patchJson(
        `/admin/events/${hackathon.id}/status`,
        { status: 'rejected' },
        adminToken
      );
      assert.equal(statusRes.status, 200);

      // Alice should have an event_cancelled notification
      const aliceNotifs = await getJson('/notifications', aliceToken);
      assert.equal(aliceNotifs.status, 200);

      const cancelNotif = aliceNotifs.data.data.notifications.find(
        (n) => n.type === 'event_cancelled' && String(n.event_id) === String(hackathon.id)
      );
      assert.ok(cancelNotif, 'Booked student should receive event_cancelled notification');
      assert.match(cancelNotif.message, /cancelled/i);
    });
  });

  describe('6. Calendar Export (.ics) Format & Reliability', () => {
    it('generates a compliant RFC 5545 .ics calendar file with valid event timestamps and details', async () => {
      const { rows: events } = await pool.query(
        "SELECT * FROM events WHERE title = 'Annual Music Festival'"
      );
      const festival = events[0];
      assert.ok(festival, 'Festival event should exist');

      const res = await fetch(`${baseUrl}/events/${festival.id}/calendar.ics`);
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type'), /text\/calendar/);
      assert.match(res.headers.get('content-disposition'), /campuspass-event-\d+\.ics/);

      const ics = await res.text();
      assert.match(ics, /BEGIN:VCALENDAR/);
      assert.match(ics, /VERSION:2\.0/);
      assert.match(ics, /PRODID:-\/\/CampusPass\/\/Event Calendar\/\/EN/);
      assert.match(ics, /BEGIN:VEVENT/);
      assert.match(ics, /SUMMARY:Annual Music Festival/);
      assert.match(ics, /LOCATION:Main Amphitheater/);
      assert.match(ics, /DTSTART:\d{8}T\d{6}Z/);
      assert.match(ics, /DTEND:\d{8}T\d{6}Z/);
      assert.match(ics, /DTSTAMP:\d{8}T\d{6}Z/);
      assert.match(ics, /UID:event-\d+-\d+@campuspass\.edu/);
      assert.match(ics, /STATUS:CONFIRMED/);
      assert.match(ics, /END:VEVENT/);
      assert.match(ics, /END:VCALENDAR/);
    });

    it('returns 404 when exporting .ics for a nonexistent event', async () => {
      const res = await fetch(`${baseUrl}/events/999999/calendar.ics`);
      assert.equal(res.status, 404);
    });
  });
});
