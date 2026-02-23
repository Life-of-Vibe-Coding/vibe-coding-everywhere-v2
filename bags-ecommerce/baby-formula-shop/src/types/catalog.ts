export type ProductImage = {
  url: string;
  alt: string;
};

export type ProductSummary = {
  id: string;
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  sizeGrams: number;
  stage: string;
  nutritionHighlights: string;
  stock: number;
  isFeatured: boolean;
  category: {
    name: string;
    slug: string;
  };
  images: ProductImage[];
};
