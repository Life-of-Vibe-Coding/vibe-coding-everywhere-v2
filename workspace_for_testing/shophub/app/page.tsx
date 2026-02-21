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
        <div className="bg-gradient-to-br from-primary to-secondary rounded-3xl p-12 md:p-16 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('/pattern.svg')] opacity-10"></div>
          <div className="relative z-10 max-w-3xl">
            <h1 className="font-heading font-bold text-5xl md:text-6xl mb-6 leading-tight">
              Discover Premium Products
            </h1>
            <p className="font-body text-xl md:text-2xl mb-8 text-white/90">
              Shop the latest trends with exclusive deals and fast shipping.
            </p>
            <Link
              href="/products"
              className="inline-flex items-center space-x-2 px-8 py-4 bg-cta hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors duration-200 cursor-pointer"
            >
              <span>Shop Now</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mb-20">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <FeatureCard
            icon={<ShoppingBag className="w-8 h-8" />}
            title="Wide Selection"
            description="Thousands of products across all categories"
          />
          <FeatureCard
            icon={<Truck className="w-8 h-8" />}
            title="Fast Shipping"
            description="Free delivery on orders over $50"
          />
          <FeatureCard
            icon={<Shield className="w-8 h-8" />}
            title="Secure Payment"
            description="Your transactions are safe with us"
          />
          <FeatureCard
            icon={<Zap className="w-8 h-8" />}
            title="Easy Returns"
            description="30-day money-back guarantee"
          />
        </div>
      </section>

      {/* Featured Products */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-heading font-bold text-4xl text-text">
            Featured Products
          </h2>
          <Link
            href="/products"
            className="font-body text-primary hover:text-secondary transition-colors cursor-pointer flex items-center space-x-2"
          >
            <span>View All</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
    <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-200 hover:shadow-lg transition-shadow duration-200">
      <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-4">
        {icon}
      </div>
      <h3 className="font-heading font-semibold text-lg text-text mb-2">
        {title}
      </h3>
      <p className="font-body text-sm text-gray-600">{description}</p>
    </div>
  );
}
