import { pool } from '../db/pool.js';

export const findPublicEvents = async ({ search, category, cursor, limit = 10 }) => {
  const conditions = ["e.status = 'approved'", "e.starts_at >= now()"];
  const params = [];

  if (category) {
    params.push(category);
    conditions.push(`e.category = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(e.title ILIKE $${params.length} OR e.description ILIKE $${params.length})`);
  }

  if (cursor) {
    params.push(cursor.starts_at, cursor.id);
    conditions.push(`(e.starts_at, e.id) > ($${params.length - 1}, $${params.length})`);
  }

  params.push(limit + 1);
  const limitParamIndex = params.length;

  const queryText = `
    SELECT
      e.id,
      e.organiser_id,
      e.title,
      e.description,
      e.category,
      e.venue,
      e.starts_at,
      e.ends_at,
      e.capacity,
      e.poster_url,
      e.status,
      e.created_at,
      u.name AS organiser_name,
      GREATEST(0, e.capacity - COALESCE(b.booked_count, 0))::int AS seats_left,
      COALESCE(b.booked_count, 0)::int AS booked_count
    FROM events e
    JOIN users u ON u.id = e.organiser_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS booked_count
      FROM bookings
      WHERE event_id = e.id AND status = 'booked'
    ) b ON true
    WHERE ${conditions.join(' AND ')}
    ORDER BY e.starts_at ASC, e.id ASC
    LIMIT $${limitParamIndex}
  `;

  const { rows } = await pool.query(queryText, params);
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  return {
    items,
    hasMore,
    nextCursor: hasMore && items.length > 0
      ? { starts_at: items[items.length - 1].starts_at, id: items[items.length - 1].id }
      : null
  };
};

export const findById = async (id, client = pool) => {
  const queryText = `
    SELECT
      e.id,
      e.organiser_id,
      e.title,
      e.description,
      e.category,
      e.venue,
      e.starts_at,
      e.ends_at,
      e.capacity,
      e.poster_url,
      e.status,
      e.created_at,
      u.name AS organiser_name,
      u.email AS organiser_email,
      GREATEST(0, e.capacity - COUNT(b.id) FILTER (WHERE b.status = 'booked'))::int AS seats_left,
      COUNT(b.id) FILTER (WHERE b.status = 'booked')::int AS booked_count,
      ROUND(AVG(r.rating)::numeric, 1) AS average_rating,
      COUNT(DISTINCT r.id)::int AS reviews_count
    FROM events e
    JOIN users u ON u.id = e.organiser_id
    LEFT JOIN bookings b ON b.event_id = e.id
    LEFT JOIN reviews r ON r.event_id = e.id
    WHERE e.id = $1
    GROUP BY e.id, u.name, u.email
  `;
  const { rows } = await client.query(queryText, [id]);
  return rows[0] || null;
};

export const createEvent = async ({
  organiser_id,
  title,
  description,
  category,
  venue,
  starts_at,
  ends_at,
  capacity,
  poster_url = null
}) => {
  const queryText = `
    INSERT INTO events (
      organiser_id, title, description, category, venue,
      starts_at, ends_at, capacity, poster_url, status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
    RETURNING *
  `;
  const { rows } = await pool.query(queryText, [
    organiser_id,
    title,
    description,
    category,
    venue,
    starts_at,
    ends_at,
    capacity,
    poster_url
  ]);
  return rows[0];
};

export const updateEvent = async (id, fields) => {
  const allowed = [
    'title',
    'description',
    'category',
    'venue',
    'starts_at',
    'ends_at',
    'capacity',
    'poster_url'
  ];
  const setClauses = [];
  const params = [];

  for (const [key, value] of Object.entries(fields)) {
    if (allowed.includes(key) && value !== undefined) {
      params.push(value);
      setClauses.push(`${key} = $${params.length}`);
    }
  }

  if (setClauses.length === 0) {
    return findById(id);
  }

  params.push(id);
  const queryText = `
    UPDATE events
    SET ${setClauses.join(', ')}
    WHERE id = $${params.length}
    RETURNING *
  `;

  const { rows } = await pool.query(queryText, params);
  return rows[0] || null;
};

export const updateEventStatus = async (id, status) => {
  const { rows } = await pool.query(
    `UPDATE events
     SET status = $1
     WHERE id = $2
     RETURNING *`,
    [status, id]
  );
  return rows[0] || null;
};

export const findByOrganiserId = async (organiserId) => {
  const queryText = `
    SELECT
      e.id,
      e.organiser_id,
      e.title,
      e.description,
      e.category,
      e.venue,
      e.starts_at,
      e.ends_at,
      e.capacity,
      e.poster_url,
      e.status,
      e.created_at,
      GREATEST(0, e.capacity - COUNT(b.id) FILTER (WHERE b.status = 'booked'))::int AS seats_left,
      COUNT(b.id) FILTER (WHERE b.status = 'booked')::int AS booked_count
    FROM events e
    LEFT JOIN bookings b ON b.event_id = e.id
    WHERE e.organiser_id = $1
    GROUP BY e.id
    ORDER BY e.created_at DESC
  `;
  const { rows } = await pool.query(queryText, [organiserId]);
  return rows;
};

export const getOrganiserStats = async (organiserId) => {
  const queryText = `
    SELECT
      COUNT(*)::int AS total_events,
      COUNT(*) FILTER (WHERE status = 'approved')::int AS approved_events,
      COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_events,
      COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected_events,
      COALESCE(SUM(booked_count), 0)::int AS total_active_bookings
    FROM (
      SELECT e.id, e.status, COUNT(b.id) FILTER (WHERE b.status = 'booked') AS booked_count
      FROM events e
      LEFT JOIN bookings b ON b.event_id = e.id
      WHERE e.organiser_id = $1
      GROUP BY e.id, e.status
    ) sub
  `;
  const { rows } = await pool.query(queryText, [organiserId]);
  return rows[0] || {
    total_events: 0,
    approved_events: 0,
    pending_events: 0,
    rejected_events: 0,
    total_active_bookings: 0
  };
};

export const getPlatformStats = async () => {
  const queryText = `
    SELECT
      (SELECT COUNT(*)::int FROM users) AS total_users,
      (SELECT COUNT(*)::int FROM users WHERE role = 'student') AS total_students,
      (SELECT COUNT(*)::int FROM users WHERE role = 'organiser') AS total_organisers,
      (SELECT COUNT(*)::int FROM events) AS total_events,
      (SELECT COUNT(*)::int FROM events WHERE status = 'pending') AS pending_events,
      (SELECT COUNT(*)::int FROM events WHERE status = 'approved') AS approved_events,
      (SELECT COUNT(*)::int FROM events WHERE status = 'rejected') AS rejected_events,
      (SELECT COUNT(*)::int FROM bookings WHERE status = 'booked') AS total_active_bookings
  `;
  const { rows } = await pool.query(queryText);
  return rows[0];
};

export const findAdminEvents = async ({ status = 'pending', category, search, limit = 50, offset = 0 } = {}) => {
  const params = [];
  const conditions = [];

  if (status && status !== 'all') {
    params.push(status);
    conditions.push(`e.status = $${params.length}`);
  }

  if (category && category !== 'all') {
    params.push(category);
    conditions.push(`e.category = $${params.length}`);
  }

  if (search && search.trim()) {
    params.push(`%${search.trim()}%`);
    conditions.push(`(e.title ILIKE $${params.length} OR e.venue ILIKE $${params.length} OR u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(limit, offset);
  const queryText = `
    SELECT
      e.id,
      e.organiser_id,
      e.title,
      e.description,
      e.category,
      e.venue,
      e.starts_at,
      e.ends_at,
      e.capacity,
      e.poster_url,
      e.status,
      e.created_at,
      u.name AS organiser_name,
      u.email AS organiser_email,
      GREATEST(0, e.capacity - COUNT(b.id) FILTER (WHERE b.status = 'booked'))::int AS seats_left,
      COUNT(b.id) FILTER (WHERE b.status = 'booked')::int AS booked_count
    FROM events e
    JOIN users u ON u.id = e.organiser_id
    LEFT JOIN bookings b ON b.event_id = e.id
    ${whereClause}
    GROUP BY e.id, u.name, u.email
    ORDER BY e.created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;

  const { rows } = await pool.query(queryText, params);
  return rows;
};

export default {
  findPublicEvents,
  findById,
  createEvent,
  updateEvent,
  updateEventStatus,
  findByOrganiserId,
  findAdminEvents,
  getOrganiserStats,
  getPlatformStats
};
