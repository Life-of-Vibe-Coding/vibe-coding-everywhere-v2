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
    <Link href={`/products/${id}`} className="group">
      <article className="glass-card rounded-2xl shadow-lg hover:shadow-2xl hover-lift overflow-hidden cursor-pointer h-full flex flex-col">
        {/* Image */}
        <div className="relative h-64 overflow-hidden bg-gradient-to-br from-card-bg to-card-hover">
          <Image
            src={image}
            alt={`Product image of ${name}`}
            fill
            className="object-cover group-hover:scale-110 transition-transform duration-300"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
          />
          <div className="absolute top-3 left-3">
            <span className="px-3 py-1.5 bg-gradient-to-r from-accent to-cta text-gray-900 text-xs font-bold rounded-full shadow-md backdrop-blur-sm">
              {category}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex-grow flex flex-col">
          <h3 className="font-heading font-bold text-xl text-text mb-2 line-clamp-1 group-hover:text-cta transition-smooth">
            {name}
          </h3>
          <p className="font-body text-sm text-text-muted mb-4 line-clamp-2 leading-relaxed flex-grow">
            {description}
          </p>

          <div className="flex items-center justify-between mt-auto">
            <span className="font-heading font-bold text-2xl bg-gradient-to-r from-cta to-accent bg-clip-text text-transparent">
              {formatPrice(price)}
            </span>
            <button
              onClick={handleAddToCart}
              className="p-3 bg-gradient-to-r from-cta to-accent hover:from-accent hover:to-cta text-gray-900 rounded-xl transition-smooth cursor-pointer shadow-md hover:shadow-lg hover:scale-110"
              title="Add to cart"
              aria-label={`Add ${name} to cart`}
            >
              <ShoppingCart className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </article>
    </Link>
  );
}
