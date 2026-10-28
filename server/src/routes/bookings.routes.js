import { Router } from 'express';
import bookingController from '../controllers/booking.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import { validateParams } from '../middleware/validate.js';
import { bookingIdParamSchema } from '../validators/booking.schemas.js';

const router = Router();

// Student cancels their booking
router.delete(
  '/:id',
  authenticate,
  requireRole('student'),
  validateParams(bookingIdParamSchema),
  bookingController.cancelBooking
);

export default router;
