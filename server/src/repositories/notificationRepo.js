import { pool } from '../db/pool.js';

export const createNotification = async (
  { userId, eventId = null, bookingId = null, type, title, message, dedupKey = null },
  client = pool
) => {
  const queryText = `
    INSERT INTO notifications (user_id, event_id, booking_id, type, title, message, dedup_key)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (dedup_key) DO NOTHING
    RETURNING id, user_id, event_id, booking_id, type, title, message, dedup_key, is_read, read_at, created_at
  `;
  const { rows } = await client.query(queryText, [
    userId,
    eventId,
    bookingId,
    type,
    title,
    message,
    dedupKey
  ]);
  return rows[0] || null;
};

export const findByUserId = async (userId, { limit = 50, offset = 0, unreadOnly = false } = {}) => {
  const conditions = ['n.user_id = $1'];
  const params = [userId];

  if (unreadOnly) {
    conditions.push('n.is_read = false');
  }

  params.push(Math.min(limit, 100));
  const limitPlaceholder = `$${params.length}`;
  params.push(Math.max(0, offset));
  const offsetPlaceholder = `$${params.length}`;

  const queryText = `
    SELECT
      n.id,
      n.user_id,
      n.event_id,
      n.booking_id,
      n.type,
      n.title,
      n.message,
      n.dedup_key,
      n.is_read,
      n.read_at,
      n.created_at,
      e.title AS event_title,
      e.venue AS event_venue,
      e.starts_at AS event_starts_at
    FROM notifications n
    LEFT JOIN events e ON e.id = n.event_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY n.created_at DESC
    LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}
  `;

  const { rows } = await pool.query(queryText, params);
  return rows;
};

export const countUnreadByUserId = async (userId) => {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS unread_count FROM notifications WHERE user_id = $1 AND is_read = false',
    [userId]
  );
  return rows[0]?.unread_count || 0;
};

export const findById = async (id) => {
  const { rows } = await pool.query(
    `SELECT n.*, e.title AS event_title
     FROM notifications n
     LEFT JOIN events e ON e.id = n.event_id
     WHERE n.id = $1`,
    [id]
  );
  return rows[0] || null;
};

export const markAsRead = async (id, userId) => {
  const queryText = `
    UPDATE notifications
    SET is_read = true, read_at = now()
    WHERE id = $1 AND user_id = $2
    RETURNING id, user_id, event_id, booking_id, type, title, message, is_read, read_at, created_at
  `;
  const { rows } = await pool.query(queryText, [id, userId]);
  return rows[0] || null;
};

export const markAllAsRead = async (userId) => {
  const queryText = `
    UPDATE notifications
    SET is_read = true, read_at = now()
    WHERE user_id = $1 AND is_read = false
    RETURNING id
  `;
  const { rows } = await pool.query(queryText, [userId]);
  return rows.length;
};

export const findActiveBookedUserIds = async (eventId) => {
  const { rows } = await pool.query(
    `SELECT DISTINCT user_id
     FROM bookings
     WHERE event_id = $1 AND status = 'booked'`,
    [eventId]
  );
  return rows.map((r) => r.user_id);
};

export default {
  createNotification,
  findByUserId,
  countUnreadByUserId,
  findById,
  markAsRead,
  markAllAsRead,
  findActiveBookedUserIds
};
