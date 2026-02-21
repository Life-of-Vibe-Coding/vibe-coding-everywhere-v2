/**
 * API client for connecting to FastAPI backend
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface FetchOptions extends RequestInit {
  token?: string;
}

/**
 * Generic API fetch wrapper with error handling
 */
async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'An error occurred' }));
    throw new Error(error.detail || `HTTP ${response.status}: ${response.statusText}`);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// ============= Authentication =============

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export const authApi = {
  register: (data: RegisterData) => 
    apiFetch<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: LoginData) => 
    apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getCurrentUser: (token: string) => 
    apiFetch<User>('/auth/me', { token }),
};

// ============= Products =============

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  stock: number;
  featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductFilters {
  category?: string;
  featured?: boolean;
  search?: string;
  skip?: number;
  limit?: number;
}

export const productsApi = {
  getAll: (filters?: ProductFilters) => {
    const params = new URLSearchParams();
    if (filters?.category) params.append('category', filters.category);
    if (filters?.featured !== undefined) params.append('featured', String(filters.featured));
    if (filters?.search) params.append('search', filters.search);
    if (filters?.skip !== undefined) params.append('skip', String(filters.skip));
    if (filters?.limit !== undefined) params.append('limit', String(filters.limit));
    
    const queryString = params.toString();
    return apiFetch<Product[]>(`/products${queryString ? `?${queryString}` : ''}`);
  },

  getById: (id: string) => 
    apiFetch<Product>(`/products/${id}`),

  create: (data: Omit<Product, 'id' | 'created_at' | 'updated_at'>, token: string) => 
    apiFetch<Product>('/products', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  update: (id: string, data: Partial<Product>, token: string) => 
    apiFetch<Product>(`/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      token,
    }),

  delete: (id: string, token: string) => 
    apiFetch<void>(`/products/${id}`, {
      method: 'DELETE',
      token,
    }),
};

// ============= Orders =============

export interface OrderItem {
  product_id: string;
  quantity: number;
  price: number;
}

export interface OrderItemResponse extends OrderItem {
  id: string;
  order_id: string;
  created_at: string;
  product: Product;
}

export interface Order {
  id: string;
  user_id: string;
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  created_at: string;
  updated_at: string;
  items: OrderItemResponse[];
}

export interface CreateOrderData {
  items: OrderItem[];
  total: number;
}

export const ordersApi = {
  create: (data: CreateOrderData, token: string) => 
    apiFetch<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  getUserOrders: (token: string, skip = 0, limit = 100) => 
    apiFetch<Order[]>(`/orders?skip=${skip}&limit=${limit}`, { token }),

  getById: (id: string, token: string) => 
    apiFetch<Order>(`/orders/${id}`, { token }),

  updateStatus: (id: string, status: Order['status'], token: string) => 
    apiFetch<Order>(`/orders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
      token,
    }),

  getAllOrders: (token: string, filters?: { status?: string; skip?: number; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.skip !== undefined) params.append('skip', String(filters.skip));
    if (filters?.limit !== undefined) params.append('limit', String(filters.limit));
    
    const queryString = params.toString();
    return apiFetch<Order[]>(`/orders/admin/all${queryString ? `?${queryString}` : ''}`, { token });
  },
};

export default {
  auth: authApi,
  products: productsApi,
  orders: ordersApi,
};
