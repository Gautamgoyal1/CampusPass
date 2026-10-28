import { verifyAccessToken } from '../utils/tokens.js';
import { AppError, unauthenticated } from '../utils/AppError.js';

export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(unauthenticated('Authentication required', 'UNAUTHENTICATED'));
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      name: payload.name
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Access token expired', 401, 'TOKEN_EXPIRED'));
    }
    return next(unauthenticated('Invalid access token', 'UNAUTHENTICATED'));
  }
};

export const optionalAuthenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      name: payload.name
    };
  } catch (err) {
    // Ignore invalid/expired optional token
  }
  next();
};
