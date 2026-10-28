import { Router } from 'express';
import authRoutes from './auth.routes.js';
import eventsRoutes from './events.routes.js';
import bookingsRoutes from './bookings.routes.js';
import adminRoutes from './admin.routes.js';
import eventController from '../controllers/event.controller.js';
import bookingController from '../controllers/booking.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth endpoints
router.use('/auth', authRoutes);

// Public & organiser event endpoints
router.use('/events', eventsRoutes);

// Direct booking operations (cancel)
router.use('/bookings', bookingsRoutes);

// Admin endpoints
router.use('/admin', adminRoutes);

// Me endpoints
router.get('/me/events', authenticate, requireRole('organiser', 'admin'), eventController.getMyEvents);
router.get('/me/bookings', authenticate, requireRole('student'), bookingController.getMyBookings);

export default router;
