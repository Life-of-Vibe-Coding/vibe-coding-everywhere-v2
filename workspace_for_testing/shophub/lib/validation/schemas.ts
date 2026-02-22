/**
 * Validation schemas using Zod
 */

import { z } from 'zod';

// User Schemas
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// Order Schemas
export const orderItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  price: z.number().min(0, 'Price must be non-negative'),
});

export const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1, 'At least one item is required'),
  total: z.number().min(0, 'Total must be non-negative'),
});

// Product Schemas
export const productFiltersSchema = z.object({
  category: z.string().optional(),
  featured: z.string().optional(),
  search: z.string().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type ProductFiltersInput = z.infer<typeof productFiltersSchema>;
