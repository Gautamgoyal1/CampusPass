import notificationRepo from '../repositories/notificationRepo.js';
import { notFound, forbidden } from '../utils/AppError.js';

export const getUserNotifications = async (userId, options = {}) => {
  const notifications = await notificationRepo.findByUserId(userId, options);
  const unreadCount = await notificationRepo.countUnreadByUserId(userId);
  return { notifications, unreadCount };
};

export const getUnreadCount = async (userId) => {
  return notificationRepo.countUnreadByUserId(userId);
};

export const markAsRead = async (id, userId) => {
  const existing = await notificationRepo.findById(id);
  if (!existing) {
    throw notFound('Notification not found', 'NOT_FOUND');
  }

  if (String(existing.user_id) !== String(userId)) {
    throw forbidden('You cannot access another user’s notifications', 'FORBIDDEN');
  }

  return notificationRepo.markAsRead(id, userId);
};

export const markAllAsRead = async (userId) => {
  const count = await notificationRepo.markAllAsRead(userId);
  return { updatedCount: count };
};

export const notifyBookingConfirmed = async (userId, event, booking) => {
  try {
    const formattedDate = new Date(event.starts_at).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });

    return await notificationRepo.createNotification({
      userId,
      eventId: event.id,
      bookingId: booking.id,
      type: 'booking_confirmed',
      title: 'Booking Confirmed',
      message: `Your booking for "${event.title}" has been confirmed for ${formattedDate} at ${event.venue}.`,
      dedupKey: `booking_confirmed:${booking.id}`
    });
  } catch (err) {
    console.error('Failed to create booking confirmation notification:', err);
    return null;
  }
};

export const notifyBookingCancelled = async (userId, booking) => {
  try {
    const title = booking.event_title || booking.title || 'the event';
    return await notificationRepo.createNotification({
      userId,
      eventId: booking.event_id,
      bookingId: booking.id,
      type: 'booking_cancelled',
      title: 'Booking Cancelled',
      message: `Your booking for "${title}" has been cancelled.`,
      dedupKey: `booking_cancelled:${booking.id}`
    });
  } catch (err) {
    console.error('Failed to create booking cancelled notification:', err);
    return null;
  }
};

export const notifyEventCancelled = async (eventId, eventTitle, reason = '') => {
  try {
    const attendeeIds = await notificationRepo.findActiveBookedUserIds(eventId);
    if (!attendeeIds || attendeeIds.length === 0) return [];

    const notifications = [];
    for (const userId of attendeeIds) {
      const notif = await notificationRepo.createNotification({
        userId,
        eventId,
        bookingId: null,
        type: 'event_cancelled',
        title: 'Event Cancelled',
        message: `The event "${eventTitle}" has been cancelled by the organiser.${reason ? ` (${reason})` : ''}`,
        dedupKey: `event_cancelled:${eventId}:${userId}`
      });
      if (notif) notifications.push(notif);
    }
    return notifications;
  } catch (err) {
    console.error('Failed to create event cancelled notifications:', err);
    return [];
  }
};

export const notifyEventUpdated = async (event, changeSummary = 'Schedule or venue details have changed') => {
  try {
    const attendeeIds = await notificationRepo.findActiveBookedUserIds(event.id);
    if (!attendeeIds || attendeeIds.length === 0) return [];

    const notifications = [];
    const updateSignature = `${new Date(event.starts_at).getTime()}-${event.venue}`;
    for (const userId of attendeeIds) {
      const notif = await notificationRepo.createNotification({
        userId,
        eventId: event.id,
        bookingId: null,
        type: 'event_updated',
        title: 'Event Details Updated',
        message: `Notice for "${event.title}": ${changeSummary}. Venue: ${event.venue}.`,
        dedupKey: `event_updated:${event.id}:${userId}:${updateSignature}`
      });
      if (notif) notifications.push(notif);
    }
    return notifications;
  } catch (err) {
    console.error('Failed to create event updated notifications:', err);
    return [];
  }
};

export default {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  notifyBookingConfirmed,
  notifyBookingCancelled,
  notifyEventCancelled,
  notifyEventUpdated
};
