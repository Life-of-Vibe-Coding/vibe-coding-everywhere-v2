'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { ShoppingCart, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useCartStore } from '@/lib/store';
import { formatPrice } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  stock: number;
}

export default function ProductDetailPage() {
  const params = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const addItem = useCartStore((state) => state.addItem);

  useEffect(() => {
    fetchProduct();
  }, [params.id]);

  async function fetchProduct() {
    try {
      const response = await fetch(`/api/products/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setProduct(data);
      }
    } catch (error) {
      console.error('Failed to fetch product:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleAddToCart = () => {
    if (!product) return;
    for (let i = 0; i < quantity; i++) {
      addItem({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
      });
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-center py-20">
          <div className="inline-block w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-center py-20">
          <h1 className="font-heading font-bold text-3xl text-text mb-4">
            Product Not Found
          </h1>
          <Link
            href="/products"
            className="inline-flex items-center space-x-2 text-primary hover:text-secondary transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Products</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <Link
        href="/products"
        className="inline-flex items-center space-x-2 text-primary hover:text-secondary transition-colors mb-8 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="font-body">Back to Products</span>
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Image */}
        <div className="relative h-[500px] rounded-2xl overflow-hidden bg-gray-100">
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-cover"
          />
        </div>

        {/* Details */}
        <div>
          <div className="mb-4">
            <span className="px-4 py-2 bg-primary/10 text-primary text-sm font-semibold rounded-full">
              {product.category}
            </span>
          </div>

          <h1 className="font-heading font-bold text-4xl text-text mb-4">
            {product.name}
          </h1>

          <p className="font-body text-lg text-gray-600 mb-6">
            {product.description}
          </p>

          <div className="mb-6">
            <span className="font-heading font-bold text-5xl text-primary">
              {formatPrice(product.price)}
            </span>
          </div>

          <div className="mb-6">
            <p className="font-body text-sm text-gray-600">
              Stock: <span className="font-semibold">{product.stock} available</span>
            </p>
          </div>

          {/* Quantity Selector */}
          <div className="mb-8">
            <label className="font-body font-semibold text-text mb-2 block">
              Quantity
            </label>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-10 h-10 bg-gray-200 hover:bg-gray-300 rounded-lg font-bold transition-colors cursor-pointer"
              >
                -
              </button>
              <span className="font-heading font-bold text-xl w-12 text-center">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                className="w-10 h-10 bg-gray-200 hover:bg-gray-300 rounded-lg font-bold transition-colors cursor-pointer"
              >
                +
              </button>
            </div>
          </div>

          {/* Add to Cart */}
          <button
            onClick={handleAddToCart}
            disabled={product.stock === 0}
            className="w-full px-8 py-4 bg-cta hover:bg-orange-600 text-white font-heading font-semibold text-lg rounded-lg transition-colors duration-200 cursor-pointer disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            <ShoppingCart className="w-6 h-6" />
            <span>{product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
