import { redis } from '../db/redis.js';
import { rateLimited } from '../utils/AppError.js';

// In-memory fallback map if Redis is temporarily unreachable
const memoryFallbackStore = new Map();

const memoryIncr = (key, windowMs) => {
  const now = Date.now();
  const entry = memoryFallbackStore.get(key);

  if (!entry || now > entry.resetAt) {
    memoryFallbackStore.set(key, { count: 1, resetAt: now + windowMs });
    return 1;
  }

  entry.count += 1;
  return entry.count;
};

// Periodic cleanup of stale memory entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of memoryFallbackStore.entries()) {
    if (now > value.resetAt) {
      memoryFallbackStore.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

export const rateLimit = ({ windowSeconds = 60, max = 100, keyPrefix = 'rl' } = {}) => {
  return async (req, res, next) => {
    if (process.env.NODE_ENV === 'test' || process.execArgv.includes('--test')) {
      return next();
    }

    const identifier = req.user?.id || req.ip || req.connection?.remoteAddress || 'unknown';
    const key = `ratelimit:${keyPrefix}:${identifier}`;
    let current;

    try {
      current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, windowSeconds);
      }
    } catch (err) {
      // Redis unavailable: fallback to in-memory counter to prevent open exploitation
      console.warn(`Rate limiter Redis fallback activated for ${keyPrefix} (${err.message})`);
      current = memoryIncr(key, windowSeconds * 1000);
    }

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - current));

    if (current > max) {
      return next(rateLimited(`Too many requests. Please try again in ${windowSeconds} seconds.`, 'RATE_LIMITED'));
    }

    next();
  };
};

export default rateLimit;
