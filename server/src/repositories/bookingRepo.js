import { pool } from '../db/pool.js';

export const lockStudentForBooking = async (client, userId) => {
  // Transaction-level advisory lock serializes all booking requests for this student
  await client.query('SELECT pg_advisory_xact_lock($1)', [Number(userId)]);
};

export const lockEventForBooking = async (client, eventId) => {
  const { rows } = await client.query(
    `SELECT id, organiser_id, title, capacity, status, starts_at, ends_at
     FROM events
     WHERE id = $1
     FOR UPDATE`,
    [eventId]
  );
  return rows[0] || null;
};

export const findOverlappingActiveBooking = async (client, userId, startsAt, endsAt) => {
  const queryText = `
    SELECT
      b.id,
      b.event_id,
      e.title,
      e.starts_at,
      e.ends_at
    FROM bookings b
    JOIN events e ON e.id = b.event_id
    WHERE b.user_id = $1
      AND b.status = 'booked'
      AND e.starts_at < $3
      AND e.ends_at > $2
    LIMIT 1
  `;
  const { rows } = await client.query(queryText, [userId, startsAt, endsAt]);
  return rows[0] || null;
};

export const countActiveBookings = async (client, eventId) => {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM bookings
     WHERE event_id = $1 AND status = 'booked'`,
    [eventId]
  );
  return rows[0].count;
};

export const hasActiveBooking = async (client, eventId, userId) => {
  const { rows } = await client.query(
    `SELECT id
     FROM bookings
     WHERE event_id = $1 AND user_id = $2 AND status = 'booked'`,
    [eventId, userId]
  );
  return rows.length > 0;
};

export const insertBooking = async (client, { eventId, userId }) => {
  const { rows } = await client.query(
    `INSERT INTO bookings (event_id, user_id, status)
     VALUES ($1, $2, 'booked')
     RETURNING id, event_id, user_id, status, created_at, cancelled_at`,
    [eventId, userId]
  );
  return rows[0];
};

export const findByUserId = async (userId) => {
  const queryText = `
    SELECT
      b.id,
      b.event_id,
      b.user_id,
      b.status,
      b.created_at,
      b.cancelled_at,
      e.title AS event_title,
      e.description AS event_description,
      e.category AS event_category,
      e.venue AS event_venue,
      e.starts_at AS event_starts_at,
      e.ends_at AS event_ends_at,
      e.poster_url AS event_poster_url
    FROM bookings b
    JOIN events e ON e.id = b.event_id
    WHERE b.user_id = $1
    ORDER BY b.created_at DESC
  `;
  const { rows } = await pool.query(queryText, [userId]);
  return rows;
};

export const findByIdWithEvent = async (bookingId) => {
  const queryText = `
    SELECT
      b.id,
      b.event_id,
      b.user_id,
      b.status,
      b.created_at,
      b.cancelled_at,
      e.starts_at AS event_starts_at,
      e.ends_at AS event_ends_at,
      e.title AS event_title,
      e.organiser_id AS event_organiser_id
    FROM bookings b
    JOIN events e ON e.id = b.event_id
    WHERE b.id = $1
  `;
  const { rows } = await pool.query(queryText, [bookingId]);
  return rows[0] || null;
};

export const cancelBooking = async (bookingId, client = pool) => {
  const { rows } = await client.query(
    `UPDATE bookings
     SET status = 'cancelled', cancelled_at = now()
     WHERE id = $1 AND status = 'booked'
     RETURNING id, event_id, user_id, status, created_at, cancelled_at`,
    [bookingId]
  );
  return rows[0] || null;
};

export const findByEventId = async (eventId) => {
  const queryText = `
    SELECT
      b.id,
      b.event_id,
      b.user_id,
      b.status,
      b.created_at,
      b.cancelled_at,
      u.name AS user_name,
      u.email AS user_email
    FROM bookings b
    JOIN users u ON u.id = b.user_id
    WHERE b.event_id = $1
    ORDER BY b.created_at ASC
  `;
  const { rows } = await pool.query(queryText, [eventId]);
  return rows;
};

export default {
  lockStudentForBooking,
  lockEventForBooking,
  findOverlappingActiveBooking,
  countActiveBookings,
  hasActiveBooking,
  insertBooking,
  findByUserId,
  findByIdWithEvent,
  cancelBooking,
  findByEventId
};
