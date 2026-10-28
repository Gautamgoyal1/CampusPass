import { AppError } from '../utils/AppError.js';

export const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const details = result.error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message
    }));
    return next(new AppError('Validation failed', 422, 'VALIDATION_ERROR', details));
  }
  req.body = result.data;
  next();
};
export const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    const details = result.error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message
    }));
    return next(new AppError('Validation failed', 422, 'VALIDATION_ERROR', details));
  }
  req.query = result.data;
  next();
};
export const validateParams = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.params);
  if (!result.success) {
    const details = result.error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message
    }));
    return next(new AppError('Invalid URL parameters', 422, 'VALIDATION_ERROR', details));
  }
  req.params = result.data;
  next();
};
