import notificationService from '../services/notificationService.js';

export const getMyNotifications = async (req, res, next) => {
  try {
    const { limit = 50, offset = 0, unreadOnly } = req.query;
    const result = await notificationService.getUserNotifications(req.user.id, {
      limit: Number(limit) || 50,
      offset: Number(offset) || 0,
      unreadOnly: unreadOnly === 'true'
    });

    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (err) {
    next(err);
  }
};

export const getUnreadCount = async (req, res, next) => {
  try {
    const unreadCount = await notificationService.getUnreadCount(req.user.id);
    res.status(200).json({
      status: 'success',
      data: { unreadCount }
    });
  } catch (err) {
    next(err);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const notification = await notificationService.markAsRead(id, req.user.id);
    res.status(200).json({
      status: 'success',
      data: { notification }
    });
  } catch (err) {
    next(err);
  }
};

export const markAllAsRead = async (req, res, next) => {
  try {
    const result = await notificationService.markAllAsRead(req.user.id);
    res.status(200).json({
      status: 'success',
      message: 'All notifications marked as read',
      data: result
    });
  } catch (err) {
    next(err);
  }
};

export default {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead
};
