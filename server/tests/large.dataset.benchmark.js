import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { seed } from '../src/db/seed.js';

let server;
let baseUrl;

describe('Large Dataset (5,000 Events) Scalability & Pagination Benchmark', () => {
  before(async () => {
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://localhost:${port}/api/v1`;

    console.log('Inserting 5,000 events in batch...');
    const now = Date.now();
    const categories = ['Technology', 'Music', 'Design', 'Gaming', 'Career', 'Workshop', 'Arts'];

    // Generate 5,000 events in batches of 1,000
    for (let batch = 0; batch < 5; batch++) {
      const values = [];
      const params = [];
      for (let i = 0; i < 1000; i++) {
        const idx = batch * 1000 + i;
        const paramBase = i * 7;
        const startsAt = new Date(now + (idx + 1) * 3600 * 1000).toISOString();
        const endsAt = new Date(now + (idx + 3) * 3600 * 1000).toISOString();
        const cat = categories[idx % categories.length];

        values.push(`(2, $${paramBase + 1}, $${paramBase + 2}, $${paramBase + 3}, $${paramBase + 4}, $${paramBase + 5}, $${paramBase + 6}, $${paramBase + 7}, 'approved')`);
        params.push(
          `Bench Event ${idx}`,
          `Description for large dataset benchmark event number ${idx}`,
          cat,
          `Campus Hall ${idx % 50}`,
          startsAt,
          endsAt,
          100
        );
      }

      await pool.query(
        `INSERT INTO events (organiser_id, title, description, category, venue, starts_at, ends_at, capacity, status)
         VALUES ${values.join(', ')}`,
        params
      );
    }

    const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM events WHERE title LIKE 'Bench Event%'");
    console.log(`Successfully bulk-inserted ${rows[0].count} benchmark events into PostgreSQL.`);
  });

  after(async () => {
    console.log('Cleaning up benchmark events and restoring seed data...');
    await pool.query("DELETE FROM events WHERE title LIKE 'Bench Event%'");
    await seed();
    server.close();
  });

  it('Fetches first page of events from 5,000 records in under 60ms', async () => {
    const t0 = performance.now();
    const res = await fetch(`${baseUrl}/events?limit=10`);
    const duration = performance.now() - t0;
    const data = await res.json();

    console.log(`Page 1 response time: ${duration.toFixed(2)}ms`);
    assert.equal(res.status, 200);
    assert.equal(data.data.events.length, 10);
    assert.ok(data.data.nextCursor);
    assert.ok(duration < 250, `Expected response time under 250ms, got ${duration}ms`);
  });

  it('Navigates 5 consecutive cursor pages across 5,000 records accurately', async () => {
    let cursor = null;
    const seenIds = new Set();

    for (let page = 1; page <= 5; page++) {
      const url = cursor ? `${baseUrl}/events?limit=10&cursor=${cursor}` : `${baseUrl}/events?limit=10`;
      const t0 = performance.now();
      const res = await fetch(url);
      const latency = performance.now() - t0;
      const data = await res.json();

      assert.equal(res.status, 200);
      assert.equal(data.data.events.length, 10);

      // Verify no duplicate IDs across pages
      for (const ev of data.data.events) {
        assert.ok(!seenIds.has(ev.id), `Duplicate event ${ev.id} found on page ${page}`);
        seenIds.add(ev.id);
      }

      cursor = data.data.nextCursor;
      assert.ok(cursor, `Next cursor must be present on page ${page}`);
      console.log(`Page ${page} cursor navigation latency: ${latency.toFixed(2)}ms (nextCursor: ${cursor.slice(0, 15)}...)`);
    }

    assert.equal(seenIds.size, 50, 'Must have traversed 50 distinct events across 5 pages');
  });

  it('Filters by category with 5,000 records efficiently', async () => {
    const t0 = performance.now();
    const res = await fetch(`${baseUrl}/events?category=Technology&limit=10`);
    const duration = performance.now() - t0;
    const data = await res.json();

    console.log(`Category filter response time: ${duration.toFixed(2)}ms`);
    assert.equal(res.status, 200);
    for (const ev of data.data.events) {
      assert.equal(ev.category, 'Technology');
    }
    assert.ok(duration < 200, `Expected filter response time under 200ms, got ${duration}ms`);
  });
});
