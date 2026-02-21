'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import { useCartStore } from '@/lib/store';
import { formatPrice } from '@/lib/utils';
import { useSession } from 'next-auth/react';

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
        <div className="text-center py-20">
          <ShoppingBag className="w-24 h-24 text-gray-300 mx-auto mb-6" />
          <h1 className="font-heading font-bold text-3xl text-text mb-4">
            Your cart is empty
          </h1>
          <p className="font-body text-gray-600 mb-8">
            Add some products to get started!
          </p>
          <Link
            href="/products"
            className="inline-block px-8 py-4 bg-primary hover:bg-secondary text-white font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Continue Shopping
          </Link>
        </div>
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
            <div
              key={item.id}
              className="bg-white p-6 rounded-2xl shadow-md border border-gray-200 flex items-center space-x-6"
            >
              <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                <Image
                  src={item.image}
                  alt={item.name}
                  fill
                  className="object-cover"
                />
              </div>

              <div className="flex-1">
                <h3 className="font-heading font-semibold text-lg text-text mb-2">
                  {item.name}
                </h3>
                <p className="font-body text-primary font-bold">
                  {formatPrice(item.price)}
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  className="w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded-lg font-bold transition-colors cursor-pointer"
                >
                  <Minus className="w-4 h-4 mx-auto" />
                </button>
                <span className="font-heading font-bold text-lg w-8 text-center">
                  {item.quantity}
                </span>
                <button
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  className="w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded-lg font-bold transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4 mx-auto" />
                </button>
              </div>

              <button
                onClick={() => removeItem(item.id)}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
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
