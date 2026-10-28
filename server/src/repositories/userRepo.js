import { pool } from '../db/pool.js';

export const findByEmail = async (email) => {
  const { rows } = await pool.query(
    'SELECT id, name, email, password_hash, role, created_at FROM users WHERE email = $1',
    [email]
  );
  return rows[0] || null;
};

export const findById = async (id) => {
  const { rows } = await pool.query(
    'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
    [id]
  );
  return rows[0] || null;
};

export const createUser = async ({ name, email, password_hash, role = 'student' }) => {
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role, created_at`,
    [name, email, password_hash, role]
  );
  return rows[0];
};

export const updateRole = async (id, role) => {
  const { rows } = await pool.query(
    `UPDATE users
     SET role = $1
     WHERE id = $2
     RETURNING id, name, email, role, created_at`,
    [role, id]
  );
  return rows[0] || null;
};

export const findAllUsers = async ({ search = '', role = '', limit = 20, offset = 0 } = {}) => {
  const conditions = [];
  const params = [];

  if (search && search.trim()) {
    params.push(`%${search.trim()}%`);
    conditions.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length})`);
  }

  if (role && role !== 'all') {
    params.push(role);
    conditions.push(`role = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countQuery = `SELECT COUNT(*)::int AS total FROM users ${whereClause}`;
  const countResult = await pool.query(countQuery, params);
  const total = countResult.rows[0]?.total || 0;

  const queryParams = [...params, limit, offset];
  const queryText = `
    SELECT id, name, email, role, created_at
    FROM users
    ${whereClause}
    ORDER BY created_at DESC, id DESC
    LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
  `;
  const { rows } = await pool.query(queryText, queryParams);
  return { users: rows, total };
};

export default {
  findByEmail,
  findById,
  createUser,
  updateRole,
  findAllUsers
};
