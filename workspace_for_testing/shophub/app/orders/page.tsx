'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Package } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import EmptyState from '@/components/EmptyState';
import StatusBadge from '@/components/StatusBadge';

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  product: {
    name: string;
    image: string;
  };
}

interface Order {
  id: string;
  total: number;
  status: string;
  createdAt: string;
  items: OrderItem[];
}

export default function OrdersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      fetchOrders();
    }
  }, [status]);

  async function fetchOrders() {
    try {
      const response = await fetch('/api/orders');
      if (response.ok) {
        const data = await response.json();
        setOrders(data);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-center py-20">
          <div className="inline-block w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <h1 className="font-heading font-bold text-5xl text-text mb-8">
        My Orders
      </h1>

      {orders.length === 0 ? (
        <EmptyState
          icon={<Package className="w-12 h-12 text-gray-700" aria-hidden="true" />}
          title="No orders yet"
          description="Start shopping to see your orders here!"
        />
      ) : (
        <div className="space-y-6">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-white p-6 rounded-2xl shadow-md border border-gray-200"
            >
              <div className="flex items-center justify-between mb-4 pb-4 border-b">
                <div>
                  <p className="font-body text-sm text-gray-600">
                    Order ID: <span className="font-semibold">{order.id.slice(0, 8)}</span>
                  </p>
                  <p className="font-body text-sm text-gray-600">
                    Date: {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <StatusBadge status={order.status} />
                  <p className="font-heading font-bold text-xl text-primary mt-2">
                    {formatPrice(order.total)}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center space-x-4">
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                      <Image
                        src={item.product.image}
                        alt={item.product.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-body font-semibold text-text">
                        {item.product.name}
                      </h4>
                      <p className="font-body text-sm text-gray-600">
                        Quantity: {item.quantity} × {formatPrice(item.price)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

