/**
 * Authentication utilities
 */

import { auth } from '../auth';
import { prisma } from '../prisma';
import type { User, ExtendedSession } from '../types';

export class AuthService {
  /**
   * Get the current session
   */
  static async getSession(): Promise<ExtendedSession | null> {
    const session = await auth();
    return session as ExtendedSession | null;
  }

  /**
   * Get the current authenticated user
   * @throws Error if user is not authenticated or not found
   */
  static async getCurrentUser(): Promise<User> {
    const session = await this.getSession();
    
    if (!session?.user?.email) {
      throw new Error('Unauthorized');
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user as User;
  }

  /**
   * Check if user is authenticated
   */
  static async isAuthenticated(): Promise<boolean> {
    const session = await this.getSession();
    return !!session?.user;
  }

  /**
   * Require authentication - throws if not authenticated
   */
  static async requireAuth(): Promise<User> {
    return this.getCurrentUser();
  }
}
