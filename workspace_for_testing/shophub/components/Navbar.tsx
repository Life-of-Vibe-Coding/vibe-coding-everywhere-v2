'use client';

import Link from 'next/link';
import { ShoppingCart, User, LogOut } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { useCartStore } from '@/lib/store';

export default function Navbar() {
  const { data: session } = useSession();
  const totalItems = useCartStore((state) => state.getTotalItems());

  return (
    <nav className="fixed top-4 left-4 right-4 z-50 bg-white/90 backdrop-blur-md shadow-lg rounded-2xl border border-gray-200">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2 group">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center transform group-hover:scale-105 transition-transform duration-200">
              <span className="text-white font-heading font-bold text-xl">S</span>
            </div>
            <span className="font-heading font-bold text-2xl text-text">ShopHub</span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            <Link
              href="/"
              className="font-body text-text hover:text-primary transition-colors duration-200 cursor-pointer"
            >
              Home
            </Link>
            <Link
              href="/products"
              className="font-body text-text hover:text-primary transition-colors duration-200 cursor-pointer"
            >
              Products
            </Link>
            {session?.user && (
              <Link
                href="/orders"
                className="font-body text-text hover:text-primary transition-colors duration-200 cursor-pointer"
              >
                Orders
              </Link>
            )}
          </div>

          {/* User Actions */}
          <div className="flex items-center space-x-4">
            {/* Cart */}
            <Link
              href="/cart"
              className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200 cursor-pointer"
            >
              <ShoppingCart className="w-6 h-6 text-text" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 bg-cta text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </Link>

            {/* User Menu */}
            {session?.user ? (
              <div className="flex items-center space-x-3">
                <Link
                  href="/account"
                  className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200 cursor-pointer"
                >
                  <User className="w-6 h-6 text-text" />
                  <span className="hidden md:block font-body text-sm text-text">
                    {session.user.name}
                  </span>
                </Link>
                <button
                  onClick={() => signOut()}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200 cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-6 h-6 text-text" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="px-6 py-2 bg-primary text-white font-body font-semibold rounded-lg hover:bg-secondary transition-colors duration-200 cursor-pointer"
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
