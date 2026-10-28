import { Router } from 'express';
import authRoutes from './auth.routes.js';
import eventsRoutes from './events.routes.js';
import bookingsRoutes from './bookings.routes.js';
import adminRoutes from './admin.routes.js';
import notificationsRoutes from './notifications.routes.js';
import eventController from '../controllers/event.controller.js';
import bookingController from '../controllers/booking.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';

import { pool } from '../db/pool.js';
import { redis } from '../db/redis.js';

const router = Router();

// Health check with live database and redis dependency verification
router.get('/health', async (req, res) => {
  let dbStatus = 'ok';
  let redisStatus = 'ok';
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    dbStatus = 'down';
  }
  try {
    await redis.ping();
  } catch (err) {
    redisStatus = 'down';
  }

  const isHealthy = dbStatus === 'ok' && redisStatus === 'ok';
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    services: {
      database: dbStatus,
      redis: redisStatus
    },
    timestamp: new Date().toISOString()
  });
});

// Auth endpoints
router.use('/auth', authRoutes);

// Public & organiser event endpoints
router.use('/events', eventsRoutes);

// Direct booking operations (cancel)
router.use('/bookings', bookingsRoutes);

// Admin endpoints
router.use('/admin', adminRoutes);

// Notifications endpoints
router.use('/notifications', notificationsRoutes);
router.use('/me/notifications', notificationsRoutes);

// Me endpoints
router.get('/me/events', authenticate, requireRole('organiser', 'admin'), eventController.getMyEvents);
router.get('/me/stats', authenticate, requireRole('organiser', 'admin'), eventController.getMyStats);
router.get('/me/bookings', authenticate, requireRole('student'), bookingController.getMyBookings);

export default router;
