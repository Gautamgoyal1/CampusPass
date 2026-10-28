import { Router } from 'express';
import authController from '../controllers/auth.controller.js';
import { validateBody } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../validators/auth.schemas.js';
import { authenticate } from '../middleware/authenticate.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();

const authLimiter = rateLimit({ windowSeconds: 60, max: 20, keyPrefix: 'auth' });

router.post('/register', authLimiter, validateBody(registerSchema), authController.register);
router.post('/login', authLimiter, validateBody(loginSchema), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.me);

export default router;
