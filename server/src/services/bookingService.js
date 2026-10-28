import { pool } from '../db/pool.js';
import bookingRepo from '../repositories/bookingRepo.js';
import eventRepo from '../repositories/eventRepo.js';
import {
  AppError,
  notFound,
  conflict,
  forbidden,
  badRequest
} from '../utils/AppError.js';
import { invalidateEventCaches } from '../db/redis.js';

export const bookSeat = async (eventId, user) => {
  if (user.role !== 'student') {
    throw forbidden('Only students can book seats for events', 'FORBIDDEN');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Transaction-scoped advisory lock serializes booking attempts for this student,
    // preventing concurrent attempts for two different overlapping events from racing.
    await bookingRepo.lockStudentForBooking(client, user.id);

    // 2. Lock event row to serialize competing seat reservations for this event
    const event = await bookingRepo.lockEventForBooking(client, eventId);
    if (!event) {
      throw notFound('Event not found', 'NOT_FOUND');
    }

    if (event.status !== 'approved') {
      throw badRequest('Event is not open for booking', 'NOT_FOUND');
    }

    if (new Date(event.starts_at) <= new Date()) {
      throw badRequest('Event has already started or ended', 'EVENT_ENDED');
    }

    // 3. Check if user already has an active booking for this exact event
    const alreadyBooked = await bookingRepo.hasActiveBooking(client, eventId, user.id);
    if (alreadyBooked) {
      throw conflict('You already have an active booking for this event', 'ALREADY_BOOKED');
    }

    // 4. Check whether any of the student's other active bookings overlap this event's complete interval:
    // existing.starts_at < new.ends_at AND existing.ends_at > new.starts_at
    const overlapping = await bookingRepo.findOverlappingActiveBooking(
      client,
      user.id,
      event.starts_at,
      event.ends_at
    );

    if (overlapping) {
      throw conflict(
        `You already have a booking for an event scheduled during this time (${overlapping.title}).`,
        'SCHEDULE_CONFLICT',
        {
          conflictingEventId: overlapping.event_id,
          conflictingEventTitle: overlapping.title,
          starts_at: overlapping.starts_at,
          ends_at: overlapping.ends_at
        }
      );
    }

    // 5. Count active bookings vs capacity
    const activeCount = await bookingRepo.countActiveBookings(client, eventId);
    if (activeCount >= event.capacity) {
      throw conflict('Event is fully booked', 'EVENT_FULL');
    }

    // 6. Insert booking (protected also by partial unique index)
    const booking = await bookingRepo.insertBooking(client, {
      eventId,
      userId: user.id
    });

    await client.query('COMMIT');

    // Invalidate event cache so seatsLeft is updated
    await invalidateEventCaches();

    return booking;
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      throw conflict('You already have an active booking for this event', 'ALREADY_BOOKED');
    }
    throw err;
  } finally {
    client.release();
  }
};

export const cancelBooking = async (bookingId, user) => {
  const booking = await bookingRepo.findByIdWithEvent(bookingId);
  if (!booking) {
    throw notFound('Booking not found', 'NOT_FOUND');
  }

  if (String(booking.user_id) !== String(user.id)) {
    throw forbidden('You can only cancel your own bookings', 'FORBIDDEN');
  }

  if (booking.status === 'cancelled') {
    throw badRequest('Booking is already cancelled', 'ALREADY_CANCELLED');
  }

  const startsAt = new Date(booking.event_starts_at).getTime();
  const now = Date.now();
  const twoHoursMs = 2 * 60 * 60 * 1000;

  if (startsAt - now < twoHoursMs) {
    throw conflict(
      'Bookings cannot be cancelled less than 2 hours before the event starts',
      'CANCEL_WINDOW_CLOSED'
    );
  }

  const cancelled = await bookingRepo.cancelBooking(bookingId);
  await invalidateEventCaches();
  return cancelled;
};

export const getUserBookings = async (userId) => {
  return bookingRepo.findByUserId(userId);
};

export const getEventAttendees = async (eventId, user) => {
  const event = await eventRepo.findById(eventId);
  if (!event) {
    throw notFound('Event not found', 'NOT_FOUND');
  }

  const isOrganiser = String(event.organiser_id) === String(user.id);
  const isAdmin = user.role === 'admin';

  if (!isOrganiser && !isAdmin) {
    throw forbidden('Only the event organiser or an admin can view attendee lists', 'FORBIDDEN');
  }

  return bookingRepo.findByEventId(eventId);
};

export default {
  bookSeat,
  cancelBooking,
  getUserBookings,
  getEventAttendees
};
