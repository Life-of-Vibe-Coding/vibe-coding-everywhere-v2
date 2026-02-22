/**
 * Order service - handles order business logic
 */

import { prisma } from '../prisma';
import type { Order, OrderItem, CreateOrderData, OrderStatus } from '../types';

export class OrderService {
  /**
   * Create a new order
   */
  static async createOrder(userId: string, orderData: CreateOrderData): Promise<Order> {
    const order = await prisma.order.create({
      data: {
        userId,
        total: orderData.total,
        status: 'pending',
        items: {
          create: orderData.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return order as Order;
  }

  /**
   * Get all orders for a user
   */
  static async getUserOrders(userId: string): Promise<Order[]> {
    const orders = await prisma.order.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return orders as Order[];
  }

  /**
   * Get a single order by ID
   */
  static async getOrderById(id: string, userId?: string): Promise<Order | null> {
    const where: any = { id };
    
    // If userId is provided, ensure the order belongs to the user
    if (userId) {
      where.userId = userId;
    }

    const order = await prisma.order.findFirst({
      where,
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return order as Order | null;
  }

  /**
   * Update order status
   */
  static async updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
    const order = await prisma.order.update({
      where: { id },
      data: { status },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return order as Order;
  }

  /**
   * Validate order items
   */
  static validateOrderItems(items: OrderItem[]): boolean {
    if (!items || items.length === 0) {
      return false;
    }

    return items.every(item => 
      item.productId && 
      item.quantity > 0 && 
      item.price >= 0
    );
  }

  /**
   * Calculate order total
   */
  static calculateTotal(items: OrderItem[]): number {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }
}
