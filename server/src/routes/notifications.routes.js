import { Router } from 'express';
import notificationController from '../controllers/notification.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { validateParams } from '../middleware/validate.js';
import { notificationIdParamSchema } from '../validators/booking.schemas.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();

const notifLimiter = rateLimit({ windowSeconds: 60, max: 120, keyPrefix: 'notif' });

router.use(authenticate, notifLimiter);

router.get('/', notificationController.getMyNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.patch('/read-all', notificationController.markAllAsRead);
router.patch('/:id/read', validateParams(notificationIdParamSchema), notificationController.markAsRead);

export default router;
