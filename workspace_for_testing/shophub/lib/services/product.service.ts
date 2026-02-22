/**
 * Product service - handles product business logic
 */

import { prisma } from '../prisma';
import type { Product, ProductFilters } from '../types';
import { Prisma } from '@prisma/client';

export class ProductService {
  /**
   * Build where clause from filters
   */
  private static buildWhereClause(filters: ProductFilters): Prisma.ProductWhereInput {
    const where: Prisma.ProductWhereInput = {};

    if (filters.category && filters.category !== 'all') {
      where.category = filters.category;
    }

    if (filters.featured === true) {
      where.featured = true;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  /**
   * Get all products with optional filters
   */
  static async getProducts(filters: ProductFilters = {}): Promise<Product[]> {
    const where = this.buildWhereClause(filters);

    const products = await prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return products as Product[];
  }

  /**
   * Get a single product by ID
   */
  static async getProductById(id: string): Promise<Product | null> {
    const product = await prisma.product.findUnique({
      where: { id },
    });

    return product as Product | null;
  }

  /**
   * Check if a product exists
   */
  static async productExists(id: string): Promise<boolean> {
    const count = await prisma.product.count({
      where: { id },
    });

    return count > 0;
  }

  /**
   * Validate product stock for order items
   */
  static async validateStock(productId: string, quantity: number): Promise<boolean> {
    const product = await this.getProductById(productId);
    
    if (!product) {
      return false;
    }

    return product.stock >= quantity;
  }
}
