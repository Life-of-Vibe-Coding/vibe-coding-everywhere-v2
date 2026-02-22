/**
 * Shared type definitions for the application
 */

// HTTP Response Types
export interface ApiError {
  error: string;
  details?: any;
}

export interface ApiSuccess<T> {
  data: T;
  message?: string;
}

// User Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'customer' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

// Product Types
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  stock: number;
  featured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductFilters {
  category?: string;
  featured?: boolean;
  search?: string;
}

// Order Types
export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  userId: string;
  total: number;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
  items: OrderItemWithProduct[];
}

export interface OrderItemWithProduct extends OrderItem {
  id: string;
  product: Product;
}

export interface CreateOrderData {
  items: OrderItem[];
  total: number;
}

// Session Types
export interface SessionUser {
  email: string;
  name?: string | null;
  role?: string;
}

export interface ExtendedSession {
  user: SessionUser;
}
