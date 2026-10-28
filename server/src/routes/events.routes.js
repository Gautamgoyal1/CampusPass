import { Router } from 'express';
import eventController from '../controllers/event.controller.js';
import bookingController from '../controllers/booking.controller.js';
import reviewController from '../controllers/review.controller.js';
import { authenticate, optionalAuthenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import {
  createEventSchema,
  updateEventSchema,
  reviewSchema
} from '../validators/event.schemas.js';
import { eventIdParamSchema } from '../validators/booking.schemas.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();

const bookingLimiter = rateLimit({ windowSeconds: 60, max: 30, keyPrefix: 'booking' });

// Public event listing and details
router.get('/', optionalAuthenticate, eventController.listEvents);
router.get('/:id', optionalAuthenticate, validateParams(eventIdParamSchema), eventController.getEvent);

// Calendar export (.ics)
router.get(
  '/:id/calendar.ics',
  optionalAuthenticate,
  validateParams(eventIdParamSchema),
  eventController.exportEventIcs
);
router.get(
  '/:id/ics',
  optionalAuthenticate,
  validateParams(eventIdParamSchema),
  eventController.exportEventIcs
);

// Organiser / Admin event management
router.post(
  '/',
  authenticate,
  requireRole('organiser', 'admin'),
  validateBody(createEventSchema),
  eventController.createEvent
);

router.patch(
  '/:id',
  authenticate,
  requireRole('organiser', 'admin'),
  validateParams(eventIdParamSchema),
  validateBody(updateEventSchema),
  eventController.updateEvent
);

// Booking for event
router.post(
  '/:id/bookings',
  authenticate,
  requireRole('student'),
  validateParams(eventIdParamSchema),
  bookingLimiter,
  bookingController.createBooking
);

// Attendee list for event
router.get(
  '/:id/bookings',
  authenticate,
  requireRole('organiser', 'admin'),
  validateParams(eventIdParamSchema),
  bookingController.getEventAttendees
);

// Reviews for event
router.post(
  '/:id/reviews',
  authenticate,
  requireRole('student'),
  validateParams(eventIdParamSchema),
  validateBody(reviewSchema),
  reviewController.createReview
);

router.get(
  '/:id/reviews',
  validateParams(eventIdParamSchema),
  reviewController.getReviews
);

export default router;
