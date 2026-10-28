import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { redis } from '../src/db/redis.js';
import { seed } from '../src/db/seed.js';

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

const getJson = async (path, token) => {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
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
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'DELETE',
    headers
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
};

describe('Role-Based Access Control (RBAC) Tests', () => {
  let studentToken;
  let organiserToken;
  let adminToken;
  let secondOrganiserToken;

  before(async () => {
    await seed();
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://localhost:${port}/api/v1`;

    // Login users
    const studentRes = await postJson('/auth/login', {
      email: 'alice@student.campuspass.edu',
      password: 'password123'
    });
    studentToken = studentRes.data.data.accessToken;

    const organiserRes = await postJson('/auth/login', {
      email: 'organiser@campuspass.edu',
      password: 'organiser123'
    });
    organiserToken = organiserRes.data.data.accessToken;

    const adminRes = await postJson('/auth/login', {
      email: 'admin@campuspass.edu',
      password: 'admin123'
    });
    adminToken = adminRes.data.data.accessToken;

    // Create a 2nd organiser directly in DB
    const { rows } = await pool.query(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ('Organiser Two', 'organiser2@campuspass.edu', 'dummy', 'organiser')
      RETURNING id, email, role, name
    `);
    const { signAccessToken } = await import('../src/utils/tokens.js');
    secondOrganiserToken = signAccessToken(rows[0]);
  });

  after(async () => {
    server.close();
  });

  it('Visitor cannot book an event (401 UNAUTHENTICATED)', async () => {
    const res = await postJson('/events/1/bookings');
    assert.equal(res.status, 401);
    assert.equal(res.data.code, 'UNAUTHENTICATED');
  });

  it('Student cannot perform administrative actions (403 FORBIDDEN)', async () => {
    const res = await patchJson('/admin/events/1/status', { status: 'rejected' }, studentToken);
    assert.equal(res.status, 403);
    assert.equal(res.data.code, 'FORBIDDEN');
  });

  it('Student cannot create events (403 FORBIDDEN)', async () => {
    const res = await postJson(
      '/events',
      {
        title: 'Student Party',
        description: 'Unauthorized event creation attempt',
        category: 'Social',
        venue: 'Dorm',
        starts_at: new Date(Date.now() + 86400000).toISOString(),
        ends_at: new Date(Date.now() + 90000000).toISOString(),
        capacity: 20
      },
      studentToken
    );
    assert.equal(res.status, 403);
    assert.equal(res.data.code, 'FORBIDDEN');
  });

  it('Organiser cannot edit another organiser’s events (403 FORBIDDEN)', async () => {
    // Event 1 belongs to organiser 1. Organiser 2 tries to patch it.
    const res = await patchJson(
      '/events/1',
      { title: 'Hijacked Event Title' },
      secondOrganiserToken
    );
    assert.equal(res.status, 403);
    assert.equal(res.data.code, 'FORBIDDEN');
  });

  it('User cannot access or cancel another student’s bookings (403 FORBIDDEN)', async () => {
    // Alice booked Hackathon (booking id 1). Log in as Bob.
    const bobRes = await postJson('/auth/login', {
      email: 'bob@student.campuspass.edu',
      password: 'password123'
    });
    const bobToken = bobRes.data.data.accessToken;

    const res = await deleteJson('/bookings/1', bobToken);
    assert.equal(res.status, 403);
    assert.equal(res.data.code, 'FORBIDDEN');
  });

  it('Student cannot view event attendee list (403 FORBIDDEN)', async () => {
    const res = await getJson('/events/1/bookings', studentToken);
    assert.equal(res.status, 403);
    assert.equal(res.data.code, 'FORBIDDEN');
  });

  it('Organiser can view attendee list for their event (200 OK)', async () => {
    const res = await getJson('/events/1/bookings', organiserToken);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data.data.attendees));
  });

  it('Admin can approve pending events (200 OK)', async () => {
    const pendingEventsRes = await getJson('/admin/events?status=pending', adminToken);
    assert.equal(pendingEventsRes.status, 200);
    const pending = pendingEventsRes.data.data.events;
    assert.ok(pending.length > 0);

    const approveRes = await patchJson(
      `/admin/events/${pending[0].id}/status`,
      { status: 'approved' },
      adminToken
    );
    assert.equal(approveRes.status, 200);
    assert.equal(approveRes.data.data.event.status, 'approved');
  });
});
