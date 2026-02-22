/**
 * User service - handles user business logic
 */

import bcrypt from 'bcryptjs';
import { prisma } from '../prisma';
import type { User } from '../types';

export interface CreateUserData {
  email: string;
  password: string;
  name: string;
}

export class UserService {
  /**
   * Hash a password
   */
  private static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  /**
   * Verify a password
   */
  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  /**
   * Check if a user exists by email
   */
  static async userExists(email: string): Promise<boolean> {
    const count = await prisma.user.count({
      where: { email },
    });

    return count > 0;
  }

  /**
   * Get user by email
   */
  static async getUserByEmail(email: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    return user as User | null;
  }

  /**
   * Get user by ID
   */
  static async getUserById(id: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    return user as User | null;
  }

  /**
   * Create a new user
   */
  static async createUser(data: CreateUserData): Promise<User> {
    // Check if user already exists
    const exists = await this.userExists(data.email);
    if (exists) {
      throw new Error('User already exists');
    }

    // Hash the password
    const hashedPassword = await this.hashPassword(data.password);

    // Create the user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        role: 'customer',
      },
    });

    return user as User;
  }

  /**
   * Authenticate user by email and password
   */
  static async authenticate(email: string, password: string): Promise<User | null> {
    const user = await this.getUserByEmail(email);

    if (!user || !user.password) {
      return null;
    }

    const isValid = await this.verifyPassword(password, user.password);
    
    if (!isValid) {
      return null;
    }

    return user;
  }
}
