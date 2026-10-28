import bcrypt from 'bcryptjs';
import { pool } from './pool.js';
import { invalidateEventCaches } from './redis.js';

export async function seed() {
  const client = await pool.connect();
  try {
    console.log('Seeding database...');
    await client.query('BEGIN');

    // Clean existing seed tables safely in reverse dependency order
    await client.query('DELETE FROM notifications');
    await client.query('DELETE FROM reviews');
    await client.query('DELETE FROM bookings');
    await client.query('DELETE FROM refresh_tokens');
    await client.query('DELETE FROM events');
    await client.query('DELETE FROM users');

    // Reset sequences
    await client.query('ALTER SEQUENCE users_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE events_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE bookings_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE reviews_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE refresh_tokens_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE notifications_id_seq RESTART WITH 1');

    // 1. Seed users
    const defaultPasswordHash = await bcrypt.hash('password123', 10);
    const adminPasswordHash = await bcrypt.hash('admin123', 10);
    const organiserPasswordHash = await bcrypt.hash('organiser123', 10);

    const userRes = await client.query(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES
        ('Campus Admin', 'admin@campuspass.edu', '${adminPasswordHash}', 'admin'),
        ('Event Organiser', 'organiser@campuspass.edu', '${organiserPasswordHash}', 'organiser'),
        ('Alice Smith', 'alice@student.campuspass.edu', '${defaultPasswordHash}', 'student'),
        ('Bob Jones', 'bob@student.campuspass.edu', '${defaultPasswordHash}', 'student'),
        ('Charlie Brown', 'charlie@student.campuspass.edu', '${defaultPasswordHash}', 'student')
      RETURNING id, name, email, role
    `);

    const users = {};
    for (const u of userRes.rows) {
      users[u.email] = u;
    }
    console.log(`Seeded ${userRes.rows.length} users.`);

    // 2. Seed events
    const now = new Date();
    const addHours = (h) => new Date(now.getTime() + h * 60 * 60 * 1000).toISOString();
    const subDays = (d) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000).toISOString();

    const organiserId = users['organiser@campuspass.edu'].id;

    const eventRes = await client.query(`
      INSERT INTO events (organiser_id, title, description, category, venue, starts_at, ends_at, capacity, poster_url, status)
      VALUES
        (
          ${organiserId},
          'Campus Hackathon 2026',
          '48 hours of intense coding, networking, and prizes. Build solutions for real campus challenges.',
          'Technology',
          'Engineering Building, Hall A',
          '${addHours(24)}',
          '${addHours(72)}',
          50,
          'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80',
          'approved'
        ),
        (
          ${organiserId},
          'Annual Music Festival',
          'Live performances by top college bands, solo artists, and DJ sets under the stars.',
          'Music',
          'Main Amphitheater',
          '${addHours(48)}',
          '${addHours(56)}',
          100,
          'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80',
          'approved'
        ),
        (
          ${organiserId},
          'AI & Robotics Workshop',
          'Hands-on workshop building autonomous robots and generative AI agents. Limited seats available!',
          'Technology',
          'Robotics Lab 3',
          '${addHours(96)}',
          '${addHours(102)}',
          5,
          'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=800&q=80',
          'approved'
        ),
        (
          ${organiserId},
          'Design Thinking & UI/UX Seminar',
          'Learn human-centered product design principles from leading industry design leaders.',
          'Design',
          'Design Studio B',
          '${addHours(120)}',
          '${addHours(124)}',
          30,
          'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=800&q=80',
          'approved'
        ),
        (
          ${organiserId},
          'Campus Esports Championship',
          'Valorant and Rocket League inter-college tournament. Huge prize pool and trophies.',
          'Gaming',
          'Student Union Auditorium',
          '${addHours(168)}',
          '${addHours(176)}',
          64,
          'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=80',
          'pending'
        ),
        (
          ${organiserId},
          'Spring Welcome Concert',
          'The opening concert of the semester featuring student bands and vocalists.',
          'Music',
          'Campus Quad',
          '${subDays(5)}',
          '${subDays(4)}',
          150,
          'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80',
          'approved'
        )
      RETURNING id, title, status, capacity
    `);

    const events = {};
    for (const e of eventRes.rows) {
      events[e.title] = e;
    }
    console.log(`Seeded ${eventRes.rows.length} events.`);

    // 3. Seed bookings
    const aliceId = users['alice@student.campuspass.edu'].id;
    const bobId = users['bob@student.campuspass.edu'].id;
    const hackathonId = events['Campus Hackathon 2026'].id;
    const pastConcertId = events['Spring Welcome Concert'].id;

    await client.query(`
      INSERT INTO bookings (event_id, user_id, status)
      VALUES
        (${hackathonId}, ${aliceId}, 'booked'),
        (${pastConcertId}, ${aliceId}, 'booked'),
        (${pastConcertId}, ${bobId}, 'booked')
    `);
    console.log('Seeded sample bookings.');

    // 4. Seed reviews (for past concert)
    await client.query(`
      INSERT INTO reviews (event_id, user_id, rating, comment)
      VALUES
        (${pastConcertId}, ${aliceId}, 5, 'Incredible performances and great vibes! Loved every minute.'),
        (${pastConcertId}, ${bobId}, 4, 'Really great music, sound system was clear and organized.')
    `);
    console.log('Seeded sample reviews.');

    // 5. Seed sample notifications
    await client.query(`
      INSERT INTO notifications (user_id, event_id, booking_id, type, title, message, dedup_key, is_read)
      VALUES
        (${aliceId}, ${hackathonId}, 1, 'booking_confirmed', 'Booking Confirmed', 'Your seat for "Campus Hackathon 2026" is confirmed! See you at Engineering Building, Hall A.', 'seed:booking:1', false),
        (${aliceId}, ${pastConcertId}, 2, 'booking_confirmed', 'Booking Confirmed', 'Your seat for "Spring Welcome Concert" was confirmed!', 'seed:booking:2', true),
        (${bobId}, ${hackathonId}, 3, 'booking_confirmed', 'Booking Confirmed', 'Your seat for "Campus Hackathon 2026" is confirmed!', 'seed:booking:3', false)
    `);
    console.log('Seeded sample notifications.');

    await client.query('COMMIT');
    await invalidateEventCaches();
    console.log('Seeding completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

import { fileURLToPath } from 'url';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed()
    .then(async () => {
      await pool.end();
      const { redis } = await import('./redis.js');
      await redis.quit();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      await pool.end();
      process.exit(1);
    });
}
