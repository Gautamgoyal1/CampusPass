import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

export const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {})
      },
      code: err.code,
      message: err.message,
      status: 'error',
      ...(err.details ? { details: err.details } : {})
    });
  }

  // Handle Zod errors directly if not wrapped
  if (err.name === 'ZodError') {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message
    }));
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details
      },
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details,
      status: 'error'
    });
  }

  // Database unique violation
  if (err.code === '23505') {
    return res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: 'Resource already exists or constraint violation'
      },
      code: 'CONFLICT',
      message: 'Resource already exists or constraint violation',
      status: 'error'
    });
  }

  // Database foreign key violation
  if (err.code === '23503') {
    return res.status(400).json({
      error: {
        code: 'INVALID_REFERENCE',
        message: 'Referenced entity does not exist or cannot be modified'
      },
      code: 'INVALID_REFERENCE',
      message: 'Referenced entity does not exist or cannot be modified',
      status: 'error'
    });
  }

  // Database check constraint violation
  if (err.code === '23514') {
    return res.status(400).json({
      error: {
        code: 'CONSTRAINT_VIOLATION',
        message: 'Database check constraint violation (e.g. invalid date range or capacity)'
      },
      code: 'CONSTRAINT_VIOLATION',
      message: 'Database check constraint violation (e.g. invalid date range or capacity)',
      status: 'error'
    });
  }

  // Database invalid input syntax (e.g. invalid integer/bigint literal)
  if (err.code === '22P02') {
    return res.status(400).json({
      error: {
        code: 'INVALID_INPUT_SYNTAX',
        message: 'Invalid parameter syntax for numeric identifier'
      },
      code: 'INVALID_INPUT_SYNTAX',
      message: 'Invalid parameter syntax for numeric identifier',
      status: 'error'
    });
  }

  // Unexpected internal errors
  console.error('Unhandled Server Error:', err);

  const errorObj = {
    code: 'INTERNAL_ERROR',
    message: 'Internal server error'
  };

  const response = {
    error: errorObj,
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
    status: 'error'
  };

  if (env.NODE_ENV === 'development') {
    response.stack = err.stack;
    response.debugMessage = err.message;
  }

  res.status(500).json(response);
};

export default errorHandler;
