import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';

export const signAccessToken = (user) => {
  return jwt.sign(
    {
      id: String(user.id),
      email: user.email,
      role: user.role,
      name: user.name
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.ACCESS_TOKEN_TTL }
  );
};

export const verifyAccessToken = (token) => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
};

export const generateRefreshToken = () => {
  return crypto.randomBytes(40).toString('hex');
};

export const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const setRefreshTokenCookie = (res, token) => {
  const maxAge = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
    path: '/api/v1/auth',
    maxAge
  });
};

export const clearRefreshTokenCookie = (res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
    path: '/api/v1/auth'
  });
};
