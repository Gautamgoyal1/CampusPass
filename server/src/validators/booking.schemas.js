import { z } from 'zod';

export const bookingIdParamSchema = z.object({
  id: z.coerce.number().int().positive('ID must be a positive integer')
});

export const eventIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Event ID must be a positive integer')
});

export const notificationIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Notification ID must be a positive integer')
});
