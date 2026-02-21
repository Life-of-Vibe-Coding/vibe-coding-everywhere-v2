import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: process.env.ADMIN_EMAIL || 'admin@shophub.com' },
    update: {},
    create: {
      email: process.env.ADMIN_EMAIL || 'admin@shophub.com',
      password: hashedPassword,
      name: 'Admin User',
      role: 'admin',
    },
  });

  console.log('✅ Created admin user:', admin.email);

  // Create sample products
  const products = [
    {
      name: 'Wireless Headphones',
      description: 'Premium noise-cancelling wireless headphones with 30-hour battery life.',
      price: 299.99,
      image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500',
      category: 'Electronics',
      stock: 50,
      featured: true,
    },
    {
      name: 'Smart Watch',
      description: 'Fitness tracker with heart rate monitor and GPS.',
      price: 199.99,
      image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500',
      category: 'Electronics',
      stock: 30,
      featured: true,
    },
    {
      name: 'Leather Backpack',
      description: 'Handcrafted genuine leather backpack for daily use.',
      price: 149.99,
      image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500',
      category: 'Fashion',
      stock: 25,
      featured: false,
    },
    {
      name: 'Running Shoes',
      description: 'Lightweight running shoes with advanced cushioning technology.',
      price: 129.99,
      image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500',
      category: 'Sports',
      stock: 40,
      featured: true,
    },
    {
      name: 'Coffee Maker',
      description: 'Programmable coffee maker with thermal carafe.',
      price: 89.99,
      image: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=500',
      category: 'Home',
      stock: 20,
      featured: false,
    },
    {
      name: 'Yoga Mat',
      description: 'Non-slip eco-friendly yoga mat with carrying strap.',
      price: 39.99,
      image: 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=500',
      category: 'Sports',
      stock: 60,
      featured: false,
    },
    {
      name: 'Desk Lamp',
      description: 'LED desk lamp with adjustable brightness and color temperature.',
      price: 49.99,
      image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500',
      category: 'Home',
      stock: 35,
      featured: false,
    },
    {
      name: 'Sunglasses',
      description: 'Polarized UV protection sunglasses with stylish design.',
      price: 79.99,
      image: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=500',
      category: 'Fashion',
      stock: 45,
      featured: true,
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.name.toLowerCase().replace(/\s+/g, '-') },
      update: {},
      create: {
        id: product.name.toLowerCase().replace(/\s+/g, '-'),
        ...product,
      },
    });
  }

  console.log('✅ Created sample products');
  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
