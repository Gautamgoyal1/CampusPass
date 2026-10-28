import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import router from './routes/index.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './utils/AppError.js';

export const app = express();

// Trust reverse proxy headers (for accurate client IP in rate limiting behind Docker/Nginx/ALB)
app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// Cross-Origin Resource Sharing
app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  })
);

// Body and cookie parsing
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Mount API base path
app.use('/api/v1', router);

// Catch 404 for undefined routes
app.use((req, res, next) => {
  next(notFound(`Cannot ${req.method} ${req.originalUrl}`, 'ROUTE_NOT_FOUND'));
});

// Centralized error handler
app.use(errorHandler);

export default app;
