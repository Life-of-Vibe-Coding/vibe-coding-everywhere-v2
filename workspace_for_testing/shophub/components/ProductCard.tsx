'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { useCartStore } from '@/lib/store';
import { formatPrice } from '@/lib/utils';

interface ProductCardProps {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
}

export default function ProductCard({
  id,
  name,
  description,
  price,
  image,
  category,
}: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    addItem({ id, name, price, image });
  };

  return (
    <Link href={`/products/${id}`}>
      <div className="group bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200 cursor-pointer">
        {/* Image */}
        <div className="relative h-64 overflow-hidden bg-gray-100">
          <Image
            src={image}
            alt={name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute top-3 left-3">
            <span className="px-3 py-1 bg-primary/90 text-white text-xs font-semibold rounded-full">
              {category}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <h3 className="font-heading font-semibold text-xl text-text mb-2 line-clamp-1">
            {name}
          </h3>
          <p className="font-body text-sm text-gray-600 mb-4 line-clamp-2">
            {description}
          </p>

          <div className="flex items-center justify-between">
            <span className="font-heading font-bold text-2xl text-primary">
              {formatPrice(price)}
            </span>
            <button
              onClick={handleAddToCart}
              className="p-3 bg-cta hover:bg-orange-600 text-white rounded-lg transition-colors duration-200 cursor-pointer"
              title="Add to cart"
            >
              <ShoppingCart className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}
