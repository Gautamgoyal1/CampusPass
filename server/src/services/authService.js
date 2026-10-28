import bcrypt from 'bcryptjs';
import userRepo from '../repositories/userRepo.js';
import refreshTokenRepo from '../repositories/refreshTokenRepo.js';
import {
  signAccessToken,
  generateRefreshToken,
  hashToken
} from '../utils/tokens.js';
import { AppError, unauthenticated, conflict } from '../utils/AppError.js';
import { env } from '../config/env.js';

export const register = async ({ name, email, password }) => {
  const existing = await userRepo.findByEmail(email);
  if (existing) {
    throw conflict('Email is already registered', 'ALREADY_EXISTS');
  }

  const password_hash = await bcrypt.hash(password, 10);
  const user = await userRepo.createUser({
    name,
    email,
    password_hash,
    role: 'student'
  });

  const accessToken = signAccessToken(user);
  const refreshToken = generateRefreshToken();
  const token_hash = hashToken(refreshToken);

  const expires_at = new Date();
  expires_at.setDate(expires_at.getDate() + env.REFRESH_TOKEN_TTL_DAYS);

  await refreshTokenRepo.createRefreshToken({
    user_id: user.id,
    token_hash,
    expires_at
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    },
    accessToken,
    refreshToken
  };
};

export const login = async ({ email, password }) => {
  const user = await userRepo.findByEmail(email);
  if (!user) {
    throw unauthenticated('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw unauthenticated('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const accessToken = signAccessToken(user);
  const refreshToken = generateRefreshToken();
  const token_hash = hashToken(refreshToken);

  const expires_at = new Date();
  expires_at.setDate(expires_at.getDate() + env.REFRESH_TOKEN_TTL_DAYS);

  await refreshTokenRepo.createRefreshToken({
    user_id: user.id,
    token_hash,
    expires_at
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    },
    accessToken,
    refreshToken
  };
};

export const refresh = async (refreshTokenRaw) => {
  if (!refreshTokenRaw) {
    throw unauthenticated('Refresh token is required', 'UNAUTHENTICATED');
  }

  const token_hash = hashToken(refreshTokenRaw);
  const record = await refreshTokenRepo.findByTokenHash(token_hash);

  if (!record) {
    throw unauthenticated('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }

  if (record.revoked) {
    const GRACE_PERIOD_MS = 30 * 1000;
    const timeSinceRevocation = record.revoked_at
      ? Date.now() - new Date(record.revoked_at).getTime()
      : Infinity;

    // If within grace period (e.g. concurrent tabs or parallel 401 retries), do not invalidate the user's active session
    if (timeSinceRevocation <= GRACE_PERIOD_MS) {
      const user = {
        id: record.user_id,
        name: record.name,
        email: record.email,
        role: record.role
      };
      const accessToken = signAccessToken(user);
      return {
        user,
        accessToken,
        refreshToken: refreshTokenRaw
      };
    }

    // Token used well past grace period: legitimate token-reuse attack detected.
    // Invalidate all tokens for this user.
    await refreshTokenRepo.revokeAllForUser(record.user_id);
    throw unauthenticated('Refresh token has been revoked', 'REVOKED_REFRESH_TOKEN');
  }

  if (new Date(record.expires_at) <= new Date()) {
    throw unauthenticated('Refresh token has expired', 'EXPIRED_REFRESH_TOKEN');
  }

  // Token rotation: revoke current token
  await refreshTokenRepo.revokeToken(token_hash);

  // Generate new tokens
  const user = {
    id: record.user_id,
    name: record.name,
    email: record.email,
    role: record.role
  };

  const newAccessToken = signAccessToken(user);
  const newRefreshToken = generateRefreshToken();
  const newTokenHash = hashToken(newRefreshToken);

  const expires_at = new Date();
  expires_at.setDate(expires_at.getDate() + env.REFRESH_TOKEN_TTL_DAYS);

  await refreshTokenRepo.createRefreshToken({
    user_id: user.id,
    token_hash: newTokenHash,
    expires_at
  });

  return {
    user,
    accessToken: newAccessToken,
    refreshToken: newRefreshToken
  };
};

export const logout = async (refreshTokenRaw) => {
  if (refreshTokenRaw) {
    const token_hash = hashToken(refreshTokenRaw);
    await refreshTokenRepo.revokeToken(token_hash);
  }
};

export const getUserProfile = async (userId) => {
  const user = await userRepo.findById(userId);
  if (!user) {
    throw unauthenticated('User not found', 'UNAUTHENTICATED');
  }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
};

export default {
  register,
  login,
  refresh,
  logout,
  getUserProfile
};
