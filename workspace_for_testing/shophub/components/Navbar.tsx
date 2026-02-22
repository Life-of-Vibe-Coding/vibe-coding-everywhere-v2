'use client';

import Link from 'next/link';
import { ShoppingCart, User, LogOut } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { useCartStore } from '@/lib/store';

export default function Navbar() {
  const { data: session } = useSession();
  const totalItems = useCartStore((state) => state.getTotalItems());

  return (
    <nav className="fixed top-4 left-4 right-4 z-50 glass-card backdrop-blur-md shadow-2xl rounded-2xl" aria-label="Main navigation">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link 
            href="/" 
            className="flex items-center space-x-2 group cursor-pointer"
            aria-label="ShopHub home"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-accent to-cta rounded-xl flex items-center justify-center transform group-hover:scale-110 transition-smooth shadow-lg">
              <span className="text-gray-900 font-heading font-bold text-2xl">S</span>
            </div>
            <span className="font-heading font-bold text-2xl text-text">ShopHub</span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            <Link
              href="/"
              className="font-body font-medium text-text hover:text-cta transition-smooth cursor-pointer relative group"
            >
              Home
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-cta group-hover:w-full transition-all duration-200"></span>
            </Link>
            <Link
              href="/products"
              className="font-body font-medium text-text hover:text-cta transition-smooth cursor-pointer relative group"
            >
              Products
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-cta group-hover:w-full transition-all duration-200"></span>
            </Link>
            {session?.user && (
              <Link
                href="/orders"
                className="font-body font-medium text-text hover:text-cta transition-smooth cursor-pointer relative group"
              >
                Orders
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-cta group-hover:w-full transition-all duration-200"></span>
              </Link>
            )}
          </div>

          {/* User Actions */}
          <div className="flex items-center space-x-4">
            {/* Cart */}
            <Link
              href="/cart"
              className="relative p-2 hover:bg-card-hover rounded-lg transition-smooth cursor-pointer group"
              aria-label={`Shopping cart with ${totalItems} items`}
            >
              <ShoppingCart className="w-6 h-6 text-text group-hover:text-cta transition-smooth" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 bg-gradient-to-r from-cta to-accent text-gray-900 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-md animate-pulse">
                  {totalItems}
                </span>
              )}
            </Link>

            {/* User Menu */}
            {session?.user ? (
              <div className="flex items-center space-x-3">
                <Link
                  href="/account"
                  className="flex items-center space-x-2 p-2 hover:bg-card-hover rounded-lg transition-smooth cursor-pointer group"
                  aria-label={`Account settings for ${session.user.name}`}
                >
                  <User className="w-6 h-6 text-text group-hover:text-cta transition-smooth" />
                  <span className="hidden md:block font-body text-sm text-text group-hover:text-cta transition-smooth">
                    {session.user.name}
                  </span>
                </Link>
                <button
                  onClick={() => signOut()}
                  className="p-2 hover:bg-card-hover rounded-lg transition-smooth cursor-pointer group"
                  title="Sign Out"
                  aria-label="Sign out"
                >
                  <LogOut className="w-6 h-6 text-text group-hover:text-accent transition-smooth" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="px-6 py-2.5 bg-gradient-to-r from-cta to-accent hover:from-accent hover:to-cta text-gray-900 font-body font-semibold rounded-lg transition-smooth cursor-pointer shadow-lg hover:shadow-xl hover:scale-105 focus-visible:outline-cta"
                aria-label="Sign in to your account"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
