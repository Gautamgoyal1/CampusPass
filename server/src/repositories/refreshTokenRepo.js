import { pool } from '../db/pool.js';

export const createRefreshToken = async ({ user_id, token_hash, expires_at }) => {
  const { rows } = await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, token_hash, expires_at, revoked`,
    [user_id, token_hash, expires_at]
  );
  return rows[0];
};

export const findByTokenHash = async (token_hash) => {
  const { rows } = await pool.query(
    `SELECT rt.id, rt.user_id, rt.token_hash, rt.expires_at, rt.revoked, rt.revoked_at,
            u.id as user_id, u.name, u.email, u.role
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1`,
    [token_hash]
  );
  return rows[0] || null;
};

export const revokeToken = async (token_hash) => {
  const { rows } = await pool.query(
    `UPDATE refresh_tokens
     SET revoked = true, revoked_at = now()
     WHERE token_hash = $1
     RETURNING id, revoked, revoked_at`,
    [token_hash]
  );
  return rows[0] || null;
};

export const revokeAllForUser = async (user_id) => {
  await pool.query(
    `UPDATE refresh_tokens
     SET revoked = true
     WHERE user_id = $1`,
    [user_id]
  );
};

export default {
  createRefreshToken,
  findByTokenHash,
  revokeToken,
  revokeAllForUser
};
