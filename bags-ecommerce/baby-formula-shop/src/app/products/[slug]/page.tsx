import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/formatPrice";
import { AddToCartButton } from "@/components/add-to-cart-button";

export const dynamic = "force-dynamic";

const ProductPage = async ({ params }: { params: { slug: string } }) => {
  const { slug } = params;
  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      category: true,
    },
  });

  if (!product) {
    notFound();
  }

  const primaryImage = product.images[0];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12 lg:flex-row">
      <div className="relative h-96 flex-1 overflow-hidden rounded-3xl bg-zinc-100">
        {primaryImage ? (
          <Image
            src={primaryImage.url}
            alt={primaryImage.alt}
            fill
            className="object-cover"
            priority
          />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-6">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-rose-500">
            {product.category.name}
          </p>
          <h1 className="text-3xl font-semibold text-zinc-900">
            {product.name}
          </h1>
          <p className="text-lg text-zinc-600">{product.description}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-semibold text-zinc-900">
                {formatPrice(product.priceCents)}
              </p>
              <p className="text-sm text-zinc-500">{product.sizeGrams}g tin</p>
            </div>
            <AddToCartButton
              id={product.id}
              name={product.name}
              slug={product.slug}
              priceCents={product.priceCents}
              imageUrl={primaryImage?.url ?? ""}
            />
          </div>
          <div className="mt-4 grid gap-3 text-sm text-zinc-600">
            <p>
              <span className="font-medium text-zinc-900">Stage:</span> {product.stage}
            </p>
            <p>
              <span className="font-medium text-zinc-900">Highlights:</span>{" "}
              {product.nutritionHighlights}
            </p>
            <p>
              <span className="font-medium text-zinc-900">Stock:</span> {product.stock} tins
              available
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductPage;
