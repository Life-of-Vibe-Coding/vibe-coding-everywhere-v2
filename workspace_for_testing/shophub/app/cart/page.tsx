'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingBag } from 'lucide-react';
import { useCartStore } from '@/lib/store';
import { formatPrice } from '@/lib/utils';
import { useSession } from 'next-auth/react';
import CartItemCard from '@/components/CartItemCard';
import EmptyState from '@/components/EmptyState';

export default function CartPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { items, updateQuantity, removeItem, getTotalPrice, clearCart } = useCartStore();
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    if (!session) {
      router.push('/login?redirect=/cart');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
            price: item.price,
          })),
          total: getTotalPrice(),
        }),
      });

      if (response.ok) {
        clearCart();
        router.push('/orders');
      } else {
        alert('Failed to create order');
      }
    } catch (error) {
      alert('Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <EmptyState
          icon={<ShoppingBag className="w-12 h-12 text-gray-700" aria-hidden="true" />}
          title="Your cart is empty"
          description="Add some products to get started!"
          action={{ label: 'Continue Shopping', href: '/products' }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <h1 className="font-heading font-bold text-5xl text-text mb-8">
        Shopping Cart
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <CartItemCard
              key={item.id}
              item={item}
              onIncrement={() => updateQuantity(item.id, item.quantity + 1)}
              onDecrement={() => updateQuantity(item.id, item.quantity - 1)}
              onRemove={() => removeItem(item.id)}
            />
          ))}
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-200 sticky top-28">
            <h2 className="font-heading font-bold text-2xl text-text mb-6">
              Order Summary
            </h2>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between font-body">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-semibold">{formatPrice(getTotalPrice())}</span>
              </div>
              <div className="flex justify-between font-body">
                <span className="text-gray-600">Shipping</span>
                <span className="font-semibold text-primary">Free</span>
              </div>
              <div className="border-t pt-3 flex justify-between">
                <span className="font-heading font-bold text-lg">Total</span>
                <span className="font-heading font-bold text-2xl text-primary">
                  {formatPrice(getTotalPrice())}
                </span>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full px-8 py-4 bg-cta hover:bg-orange-600 text-white font-heading font-semibold text-lg rounded-lg transition-colors duration-200 cursor-pointer disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Proceed to Checkout'}
            </button>

            <Link
              href="/products"
              className="block text-center mt-4 font-body text-primary hover:text-secondary transition-colors cursor-pointer"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
