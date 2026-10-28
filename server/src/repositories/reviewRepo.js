import { pool } from '../db/pool.js';

export const createReview = async ({ event_id, user_id, rating, comment }) => {
  const { rows } = await pool.query(
    `INSERT INTO reviews (event_id, user_id, rating, comment)
     VALUES ($1, $2, $3, $4)
     RETURNING id, event_id, user_id, rating, comment, created_at`,
    [event_id, user_id, rating, comment]
  );
  return rows[0];
};

export const findByEventId = async (event_id) => {
  const queryText = `
    SELECT
      r.id,
      r.event_id,
      r.user_id,
      r.rating,
      r.comment,
      r.created_at,
      u.name AS user_name
    FROM reviews r
    JOIN users u ON u.id = r.user_id
    WHERE r.event_id = $1
    ORDER BY r.created_at DESC
  `;
  const { rows } = await pool.query(queryText, [event_id]);
  return rows;
};

export const findByEventAndUser = async (event_id, user_id) => {
  const { rows } = await pool.query(
    `SELECT id, event_id, user_id, rating, comment, created_at
     FROM reviews
     WHERE event_id = $1 AND user_id = $2`,
    [event_id, user_id]
  );
  return rows[0] || null;
};

export const hasUserBookedEvent = async (event_id, user_id) => {
  const { rows } = await pool.query(
    `SELECT id
     FROM bookings
     WHERE event_id = $1 AND user_id = $2 AND status = 'booked'`,
    [event_id, user_id]
  );
  return rows.length > 0;
};

export default {
  createReview,
  findByEventId,
  findByEventAndUser,
  hasUserBookedEvent
};
