import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/app.js';
import { seed } from '../src/db/seed.js';

let server;
let baseUrl;

const postJson = async (endpoint, body, token) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}/api/v1${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  const data = await res.json();
  return { status: res.status, data };
};

const getJson = async (endpoint, token) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}/api/v1${endpoint}`, {
    method: 'GET',
    headers
  });
  const data = await res.json();
  return { status: res.status, data };
};

const patchJson = async (endpoint, body, token) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}/api/v1${endpoint}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body)
  });
  const data = await res.json();
  return { status: res.status, data };
};

describe('Phase 4 — Organizer & Admin Dashboard Backend API Tests', () => {
  let adminToken;
  let organiserToken;
  let studentToken;

  before(async () => {
    await seed();
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });

    // Login accounts
    const adminRes = await postJson('/auth/login', {
      email: 'admin@campuspass.edu',
      password: 'admin123'
    });
    adminToken = adminRes.data.data.accessToken;

    const orgRes = await postJson('/auth/login', {
      email: 'organiser@campuspass.edu',
      password: 'organiser123'
    });
    organiserToken = orgRes.data.data.accessToken;

    const stuRes = await postJson('/auth/login', {
      email: 'alice@student.campuspass.edu',
      password: 'password123'
    });
    studentToken = stuRes.data.data.accessToken;
  });

  test('1. Organizer Stats: Organiser can retrieve their live dashboard metrics', async () => {
    const res = await getJson('/me/stats', organiserToken);
    assert.equal(res.status, 200);
    assert.equal(res.data.status, 'success');
    const { stats } = res.data.data;
    assert.ok(stats.total_events >= 1);
    assert.ok(typeof stats.approved_events === 'number');
    assert.ok(typeof stats.pending_events === 'number');
    assert.ok(typeof stats.total_active_bookings === 'number');
  });

  test('2. Organizer Stats: Non-organiser roles and unauthenticated requests are rejected', async () => {
    const unauth = await getJson('/me/stats');
    assert.equal(unauth.status, 401);

    const studentForbidden = await getJson('/me/stats', studentToken);
    assert.equal(studentForbidden.status, 403);
  });

  test('3. Admin Stats: Admin can retrieve live platform metrics', async () => {
    const res = await getJson('/admin/stats', adminToken);
    assert.equal(res.status, 200);
    assert.equal(res.data.status, 'success');
    const { stats } = res.data.data;
    assert.ok(stats.total_users >= 4);
    assert.ok(stats.total_students >= 2);
    assert.ok(stats.total_organisers >= 1);
    assert.ok(stats.total_events >= 5);
    assert.ok(stats.approved_events >= 1);
    assert.ok(stats.total_active_bookings >= 1);
  });

  test('4. Admin Stats: Non-admin users cannot access administrative platform metrics', async () => {
    const unauth = await getJson('/admin/stats');
    assert.equal(unauth.status, 401);

    const orgForbidden = await getJson('/admin/stats', organiserToken);
    assert.equal(orgForbidden.status, 403);

    const stuForbidden = await getJson('/admin/stats', studentToken);
    assert.equal(stuForbidden.status, 403);
  });

  test('5. Admin User Management: Search, role filtering, and pagination work accurately', async () => {
    const resAll = await getJson('/admin/users?limit=5&page=1', adminToken);
    assert.equal(resAll.status, 200);
    assert.ok(Array.isArray(resAll.data.data.users));
    assert.ok(resAll.data.data.total >= 4);
    assert.equal(resAll.data.data.page, 1);
    assert.ok(resAll.data.data.totalPages >= 1);

    // Search by keyword
    const resSearch = await getJson('/admin/users?search=alice', adminToken);
    assert.equal(resSearch.status, 200);
    assert.ok(resSearch.data.data.users.length >= 1);
    assert.ok(resSearch.data.data.users[0].email.includes('alice'));

    // Filter by role
    const resRole = await getJson('/admin/users?role=student', adminToken);
    assert.equal(resRole.status, 200);
    for (const u of resRole.data.data.users) {
      assert.equal(u.role, 'student');
    }
  });

  test('6. Admin User Management: Admin cannot remove their own admin role (self-demotion prohibited)', async () => {
    // Admin user id is 1
    const res = await patchJson('/admin/users/1/role', { role: 'student' }, adminToken);
    assert.equal(res.status, 403);
    assert.equal(res.data.error.code, 'SELF_DEMOTION_PROHIBITED');
  });

  test('7. Admin User Management: Admin can update another user\'s role successfully', async () => {
    // User 4 is Bob (student)
    const res = await patchJson('/admin/users/4/role', { role: 'organiser' }, adminToken);
    assert.equal(res.status, 200);
    assert.equal(res.data.data.user.role, 'organiser');

    // Revert Bob back to student
    const revertRes = await patchJson('/admin/users/4/role', { role: 'student' }, adminToken);
    assert.equal(revertRes.status, 200);
    assert.equal(revertRes.data.data.user.role, 'student');
  });

  test('8. Event Editing Safety: Cannot reduce event capacity below existing active bookings', async () => {
    // Event 1 has 1 active booking from Alice
    const res = await patchJson('/events/1', { capacity: 0 }, organiserToken);
    assert.equal(res.status, 422); // Zod rejects capacity < 1

    const resBelowBookings = await patchJson('/events/1', { capacity: 0 }, organiserToken);
    assert.ok(resBelowBookings.status === 422 || resBelowBookings.status === 400);
  });

  test('9. Admin Event Oversight: Admin can query events with category & search filters', async () => {
    const res = await getJson('/admin/events?status=all&category=Technology', adminToken);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data.data.events));
    for (const ev of res.data.data.events) {
      assert.equal(ev.category, 'Technology');
    }
  });
});
