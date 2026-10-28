import { Router } from 'express';
import adminController from '../controllers/admin.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import { updateEventStatusSchema } from '../validators/event.schemas.js';
import { updateRoleSchema } from '../validators/auth.schemas.js';
import { bookingIdParamSchema, eventIdParamSchema } from '../validators/booking.schemas.js';

const router = Router();

router.use(authenticate, requireRole('admin'));

router.get('/events', adminController.getAdminEvents);
router.patch('/events/:id/status', validateParams(eventIdParamSchema), validateBody(updateEventStatusSchema), adminController.updateEventStatus);
router.patch('/users/:id/role', validateParams(bookingIdParamSchema), validateBody(updateRoleSchema), adminController.updateUserRole);
router.get('/users', adminController.listUsers);

export default router;
