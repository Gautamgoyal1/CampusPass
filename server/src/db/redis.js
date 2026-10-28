import Redis from 'ioredis';
import { env } from '../config/env.js';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
  lazyConnect: false
});

redis.on('connect', () => {
  console.log('Redis connected successfully');
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err.message);
});

export const cacheGet = async (key) => {
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error(`Redis get error for key ${key}:`, err.message);
    return null;
  }
};

export const cacheSet = async (key, value, ttlSeconds = 60) => {
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    console.error(`Redis set error for key ${key}:`, err.message);
  }
};

export const cacheDel = async (patternOrKey) => {
  try {
    if (patternOrKey.includes('*')) {
      const keys = await redis.keys(patternOrKey);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } else {
      await redis.del(patternOrKey);
    }
  } catch (err) {
    console.error(`Redis del error for ${patternOrKey}:`, err.message);
  }
};

export const invalidateEventCaches = async () => {
  try {
    const keys = await redis.keys('events:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (err) {
    console.error('Redis cache invalidation error:', err.message);
  }
};

export default redis;
