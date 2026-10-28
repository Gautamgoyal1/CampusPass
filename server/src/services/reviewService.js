import reviewRepo from '../repositories/reviewRepo.js';
import eventRepo from '../repositories/eventRepo.js';
import { notFound, badRequest, conflict, forbidden } from '../utils/AppError.js';
import { invalidateEventCaches } from '../db/redis.js';

export const addReview = async (eventId, { rating, comment }, user) => {
  if (user.role !== 'student') {
    throw forbidden('Only students can review events', 'FORBIDDEN');
  }

  const event = await eventRepo.findById(eventId);
  if (!event) {
    throw notFound('Event not found', 'NOT_FOUND');
  }

  // Must only be reviewed after the event has ended
  if (new Date(event.ends_at) > new Date()) {
    throw badRequest('You can only review an event after it has ended', 'EVENT_NOT_ENDED');
  }

  // Must have booked the event
  const booked = await reviewRepo.hasUserBookedEvent(eventId, user.id);
  if (!booked) {
    throw forbidden('You can only review events you have booked', 'FORBIDDEN');
  }

  // Must not have already reviewed
  const existing = await reviewRepo.findByEventAndUser(eventId, user.id);
  if (existing) {
    throw conflict('You have already submitted a review for this event', 'ALREADY_REVIEWED');
  }

  const review = await reviewRepo.createReview({
    event_id: eventId,
    user_id: user.id,
    rating,
    comment: comment || null
  });

  await invalidateEventCaches();
  return review;
};

export const getEventReviews = async (eventId) => {
  const event = await eventRepo.findById(eventId);
  if (!event) {
    throw notFound('Event not found', 'NOT_FOUND');
  }
  return reviewRepo.findByEventId(eventId);
};

export default {
  addReview,
  getEventReviews
};
