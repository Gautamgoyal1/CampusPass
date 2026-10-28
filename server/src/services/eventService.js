import eventRepo from '../repositories/eventRepo.js';
import bookingRepo from '../repositories/bookingRepo.js';
import { cacheGet, cacheSet, invalidateEventCaches } from '../db/redis.js';
import { encodeCursor, decodeCursor } from '../utils/cursor.js';
import { notFound, forbidden, badRequest } from '../utils/AppError.js';
import { pool } from '../db/pool.js';

export const getPublicEvents = async ({ search = '', category = '', cursor = null, limit = 10 }) => {
  const cacheKey = `events:list:${search}:${category}:${cursor || 'start'}:${limit}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return cached;
  }

  const decodedCursor = cursor ? decodeCursor(cursor) : null;
  const result = await eventRepo.findPublicEvents({
    search: search.trim(),
    category: category.trim(),
    cursor: decodedCursor,
    limit: Number(limit) || 10
  });

  const response = {
    events: result.items,
    nextCursor: result.nextCursor ? encodeCursor(result.nextCursor) : null,
    hasMore: result.hasMore
  };

  // Cache for 45 seconds
  await cacheSet(cacheKey, response, 45);

  return response;
};

export const getEventDetails = async (id, currentUser = null) => {
  const event = await eventRepo.findById(id);
  if (!event) {
    throw notFound('Event not found', 'NOT_FOUND');
  }

  // Non-approved events can only be viewed by the organiser or an admin
  if (event.status !== 'approved') {
    const isOwner = currentUser && String(currentUser.id) === String(event.organiser_id);
    const isAdmin = currentUser && currentUser.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw notFound('Event not found', 'NOT_FOUND');
    }
  }

  let userBooking = null;
  if (currentUser) {
    const { rows } = await eventRepo.findById(id); // booking check
    const bookings = await bookingRepo.findByUserId(currentUser.id);
    userBooking = bookings.find((b) => String(b.event_id) === String(id) && b.status === 'booked') || null;
  }

  return {
    ...event,
    hasBooked: Boolean(userBooking),
    bookingId: userBooking ? userBooking.id : null
  };
};

export const createEvent = async (eventData, user) => {
  const newEvent = await eventRepo.createEvent({
    ...eventData,
    organiser_id: user.id
  });

  await invalidateEventCaches();
  return newEvent;
};

export const updateEvent = async (id, updateData, user) => {
  const existing = await eventRepo.findById(id);
  if (!existing) {
    throw notFound('Event not found', 'NOT_FOUND');
  }

  if (user.role !== 'admin' && String(existing.organiser_id) !== String(user.id)) {
    throw forbidden('You are not authorized to edit this event', 'FORBIDDEN');
  }

  if (updateData.capacity !== undefined) {
    const activeCount = await bookingRepo.countActiveBookings(pool, id);
    if (Number(updateData.capacity) < activeCount) {
      throw badRequest(`Cannot reduce capacity below current active bookings (${activeCount})`, 'INVALID_CAPACITY');
    }
  }

  const updated = await eventRepo.updateEvent(id, updateData);
  await invalidateEventCaches();
  return updated;
};

export const getOrganiserEvents = async (organiserId) => {
  return eventRepo.findByOrganiserId(organiserId);
};

export const getOrganiserStats = async (organiserId) => {
  return eventRepo.getOrganiserStats(organiserId);
};

export const updateEventStatus = async (id, status, user) => {
  if (user.role !== 'admin') {
    throw forbidden('Admin privileges required', 'FORBIDDEN');
  }

  const existing = await eventRepo.findById(id);
  if (!existing) {
    throw notFound('Event not found', 'NOT_FOUND');
  }

  const updated = await eventRepo.updateEventStatus(id, status);
  await invalidateEventCaches();
  return updated;
};

export const getAdminEvents = async (options = {}) => {
  if (typeof options === 'string') {
    return eventRepo.findAdminEvents({ status: options });
  }
  return eventRepo.findAdminEvents(options);
};

export const getPlatformStats = async () => {
  return eventRepo.getPlatformStats();
};

export default {
  getPublicEvents,
  getEventDetails,
  createEvent,
  updateEvent,
  getOrganiserEvents,
  getOrganiserStats,
  updateEventStatus,
  getAdminEvents,
  getPlatformStats
};
