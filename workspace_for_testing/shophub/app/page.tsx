import Link from 'next/link';
import { ArrowRight, ShoppingBag, Truck, Shield, Zap } from 'lucide-react';
import ProductCard from '@/components/ProductCard';
import { prisma } from '@/lib/prisma';

async function getFeaturedProducts() {
  const products = await prisma.product.findMany({
    where: { featured: true },
    take: 4,
  });
  return products;
}

export default async function HomePage() {
  const featuredProducts = await getFeaturedProducts();

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Hero Section */}
      <section className="mb-20">
        <div className="glass-card rounded-3xl p-12 md:p-16 relative overflow-hidden shadow-2xl hover-lift">
          {/* Animated background pattern */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20"></div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-cta/10 rounded-full blur-3xl"></div>
          
          <div className="relative z-10 max-w-3xl">
            <h1 className="font-heading font-bold text-5xl md:text-7xl mb-6 leading-tight bg-gradient-to-r from-text via-cta to-accent bg-clip-text text-transparent">
              Discover Premium Products
            </h1>
            <p className="font-body text-xl md:text-2xl mb-8 text-text-muted leading-relaxed">
              Shop the latest trends with exclusive deals and fast shipping. Your ultimate shopping destination.
            </p>
            <Link
              href="/products"
              className="inline-flex items-center space-x-2 px-8 py-4 bg-gradient-to-r from-cta to-accent hover:from-accent hover:to-cta text-gray-900 font-semibold rounded-xl transition-smooth cursor-pointer shadow-lg hover:shadow-2xl hover:scale-105 focus-visible:outline-cta"
              aria-label="Shop now and browse our products"
            >
              <span>Shop Now</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FeatureCard
            icon={<ShoppingBag className="w-8 h-8" aria-hidden="true" />}
            title="Wide Selection"
            description="Thousands of products across all categories"
          />
          <FeatureCard
            icon={<Truck className="w-8 h-8" aria-hidden="true" />}
            title="Fast Shipping"
            description="Free delivery on orders over $50"
          />
          <FeatureCard
            icon={<Shield className="w-8 h-8" aria-hidden="true" />}
            title="Secure Payment"
            description="Your transactions are safe with us"
          />
          <FeatureCard
            icon={<Zap className="w-8 h-8" aria-hidden="true" />}
            title="Easy Returns"
            description="30-day money-back guarantee"
          />
        </div>
      </section>

      {/* Featured Products */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-heading font-bold text-4xl md:text-5xl text-text">
            🔥 Featured Products
          </h2>
          <Link
            href="/products"
            className="font-body text-cta hover:text-accent transition-smooth cursor-pointer flex items-center space-x-2 group"
            aria-label="View all products"
          >
            <span className="font-semibold">View All</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredProducts.map((product) => (
            <ProductCard key={product.id} {...product} />
          ))}
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div 
      className="glass-card p-6 rounded-2xl shadow-lg hover:shadow-2xl hover-lift group"
      role="article"
      aria-label={`Feature: ${title}`}
    >
      <div className="w-16 h-16 bg-gradient-to-br from-accent to-cta rounded-xl flex items-center justify-center text-gray-900 mb-4 group-hover:scale-110 transition-transform duration-200 shadow-md">
        {icon}
      </div>
      <h3 className="font-heading font-semibold text-xl text-text mb-2">
        {title}
      </h3>
      <p className="font-body text-base text-text-muted leading-relaxed">
        {description}
      </p>
    </div>
  );
}
