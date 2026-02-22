'use client';

import Image from 'next/image';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import type { CartItem } from '@/lib/store';

interface CartItemCardProps {
  item: CartItem;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
}

export default function CartItemCard({
  item,
  onIncrement,
  onDecrement,
  onRemove,
}: CartItemCardProps) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-200 flex items-center space-x-6">
      <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
        <Image
          src={item.image}
          alt={`Image of ${item.name}`}
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
          type="button"
          onClick={onDecrement}
          className="w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded-lg font-bold transition-colors cursor-pointer"
          aria-label={`Reduce quantity of ${item.name}`}
        >
          <Minus className="w-4 h-4 mx-auto" />
        </button>
        <span className="font-heading font-bold text-lg w-8 text-center">
          {item.quantity}
        </span>
        <button
          type="button"
          onClick={onIncrement}
          className="w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded-lg font-bold transition-colors cursor-pointer"
          aria-label={`Increase quantity of ${item.name}`}
        >
          <Plus className="w-4 h-4 mx-auto" />
        </button>
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
        aria-label={`Remove ${item.name} from cart`}
      >
        <Trash2 className="w-5 h-5" />
      </button>
    </div>
  );
}
