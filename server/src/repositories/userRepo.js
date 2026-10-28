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

export const findAllUsers = async ({ limit = 50, offset = 0 } = {}) => {
  const { rows } = await pool.query(
    `SELECT id, name, email, role, created_at
     FROM users
     ORDER BY id ASC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
};

export default {
  findByEmail,
  findById,
  createUser,
  updateRole,
  findAllUsers
};
