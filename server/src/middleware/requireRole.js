import { forbidden, unauthenticated } from '../utils/AppError.js';

export const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return next(unauthenticated('Authentication required', 'UNAUTHENTICATED'));
  }

  if (!allowedRoles.includes(req.user.role)) {
    return next(forbidden('You do not have permission to perform this action', 'FORBIDDEN'));
  }

  next();
};

export default requireRole;
