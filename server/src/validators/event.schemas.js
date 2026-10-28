import { z } from 'zod';

export const createEventSchema = z
  .object({
    title: z.string().trim().min(2, 'Title must be at least 2 characters').max(200),
    description: z.string().trim().min(5, 'Description must be at least 5 characters'),
    category: z.string().trim().min(2, 'Category is required'),
    venue: z.string().trim().min(2, 'Venue is required'),
    starts_at: z.string().datetime({ message: 'starts_at must be a valid ISO datetime' }),
    ends_at: z.string().datetime({ message: 'ends_at must be a valid ISO datetime' }),
    capacity: z.coerce.number().int().positive('Capacity must be greater than 0'),
    poster_url: z.string().url('poster_url must be a valid URL').optional().or(z.literal('')).nullable()
  })
  .refine((data) => new Date(data.ends_at) > new Date(data.starts_at), {
    message: 'ends_at must be after starts_at',
    path: ['ends_at']
  });

export const updateEventSchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().min(5).optional(),
    category: z.string().trim().min(2).optional(),
    venue: z.string().trim().min(2).optional(),
    starts_at: z.string().datetime().optional(),
    ends_at: z.string().datetime().optional(),
    capacity: z.coerce.number().int().positive().optional(),
    poster_url: z.string().url().optional().or(z.literal('')).nullable()
  })
  .refine(
    (data) => {
      if (data.starts_at && data.ends_at) {
        return new Date(data.ends_at) > new Date(data.starts_at);
      }
      return true;
    },
    {
      message: 'ends_at must be after starts_at',
      path: ['ends_at']
    }
  );

export const updateEventStatusSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected'], {
    errorMap: () => ({ message: 'Status must be pending, approved, or rejected' })
  })
});

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5, 'Rating must be between 1 and 5'),
  comment: z.string().trim().max(1000).optional().nullable()
});
