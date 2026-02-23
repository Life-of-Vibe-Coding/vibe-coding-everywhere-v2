import "dotenv/config";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set in the environment.");
}

const filePath = databaseUrl.startsWith("file:")
  ? databaseUrl.replace("file:", "")
  : databaseUrl;
const resolvedPath = path.resolve(process.cwd(), filePath);

const adapter = new PrismaBetterSqlite3({ url: resolvedPath });

const prisma = new PrismaClient({
  adapter,
});

const seed = async () => {
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();

  await prisma.category.createMany({
    data: [
      {
        name: "Organic Infant",
        slug: "organic-infant",
        description: "Gentle, organic blends for newborns and infants.",
      },
      {
        name: "Sensitive Tummies",
        slug: "sensitive-tummies",
        description: "Lactose-friendly options for delicate digestion.",
      },
      {
        name: "Toddler Nutrition",
        slug: "toddler-nutrition",
        description: "Balanced nutrition for curious toddlers.",
      },
    ],
  });

  const [organic, sensitive, toddler] = await prisma.category.findMany({
    orderBy: { name: "asc" },
  });

  await prisma.product.createMany({
    data: [
      {
        name: "PureStart Organic Stage 1",
        slug: "purestart-organic-stage-1",
        description:
          "USDA organic infant formula with DHA, ARA, and a smooth milk protein blend.",
        priceCents: 2899,
        sizeGrams: 680,
        stage: "Stage 1 (0-6 months)",
        nutritionHighlights: "DHA + ARA, iron-fortified, prebiotic blend",
        stock: 48,
        isFeatured: true,
        categoryId: organic.id,
      },
      {
        name: "GentleCare Sensitive",
        slug: "gentlecare-sensitive",
        description:
          "Reduced-lactose formula designed to comfort sensitive tummies and reduce gas.",
        priceCents: 3199,
        sizeGrams: 650,
        stage: "Stage 1 (0-12 months)",
        nutritionHighlights: "Reduced lactose, easy-digest proteins, probiotics",
        stock: 36,
        isFeatured: true,
        categoryId: sensitive.id,
      },
      {
        name: "BrightSteps Toddler Plus",
        slug: "brightsteps-toddler-plus",
        description:
          "Toddler formula with calcium, vitamin D, and immune-supporting vitamins.",
        priceCents: 2599,
        sizeGrams: 720,
        stage: "Stage 3 (12+ months)",
        nutritionHighlights: "Calcium + vitamin D, omega-3s, 20 vitamins",
        stock: 52,
        isFeatured: false,
        categoryId: toddler.id,
      },
      {
        name: "Harmony Organic Stage 2",
        slug: "harmony-organic-stage-2",
        description:
          "Organic follow-on formula supporting healthy growth and brain development.",
        priceCents: 2999,
        sizeGrams: 680,
        stage: "Stage 2 (6-12 months)",
        nutritionHighlights: "Organic milk, prebiotics, choline",
        stock: 40,
        isFeatured: false,
        categoryId: organic.id,
      },
      {
        name: "CalmTummy Comfort",
        slug: "calmtummy-comfort",
        description:
          "Gentle formula with partially hydrolyzed proteins for easy digestion.",
        priceCents: 3299,
        sizeGrams: 640,
        stage: "Stage 1 (0-12 months)",
        nutritionHighlights: "Partially hydrolyzed proteins, probiotics",
        stock: 28,
        isFeatured: false,
        categoryId: sensitive.id,
      },
    ],
  });

  const createdProducts = await prisma.product.findMany();

  const imageMap: Record<string, string> = {
    "purestart-organic-stage-1":
      "https://images.unsplash.com/photo-1586953208448-b95a79798f07?auto=format&fit=crop&w=800&q=80",
    "gentlecare-sensitive":
      "https://images.unsplash.com/photo-1576765607924-8b6b6c9e58b2?auto=format&fit=crop&w=800&q=80",
    "brightsteps-toddler-plus":
      "https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=800&q=80",
    "harmony-organic-stage-2":
      "https://images.unsplash.com/photo-1512069772995-ec65ed45afd6?auto=format&fit=crop&w=800&q=80",
    "calmtummy-comfort":
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=800&q=80",
  };

  await prisma.productImage.createMany({
    data: createdProducts.map((product, index) => ({
      productId: product.id,
      url: imageMap[product.slug],
      alt: `${product.name} package`,
      sortOrder: index,
    })),
  });
};

seed()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
