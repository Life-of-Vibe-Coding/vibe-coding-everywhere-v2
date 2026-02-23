import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/formatPrice";
import { AddToCartButton } from "./add-to-cart-button";
import type { ProductSummary } from "@/types/catalog";

export const ProductCard = ({ product }: { product: ProductSummary }) => {
  const primaryImage = product.images[0];

  return (
    <div className="flex h-full flex-col rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
      <Link href={`/products/${product.slug}`} className="group">
        <div className="relative h-52 overflow-hidden rounded-2xl bg-zinc-100">
          {primaryImage ? (
            <Image
              src={primaryImage.url}
              alt={primaryImage.alt}
              fill
              className="object-cover transition duration-500 group-hover:scale-105"
            />
          ) : null}
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-500">
            {product.stage}
          </p>
          <h3 className="text-lg font-semibold text-zinc-900">{product.name}</h3>
          <p className="text-sm text-zinc-600 line-clamp-2">
            {product.description}
          </p>
        </div>
      </Link>
      <div className="mt-auto flex items-center justify-between pt-4">
        <div>
          <p className="text-lg font-semibold text-zinc-900">
            {formatPrice(product.priceCents)}
          </p>
          <p className="text-xs text-zinc-500">{product.sizeGrams}g tin</p>
        </div>
        <AddToCartButton
          id={product.id}
          name={product.name}
          slug={product.slug}
          priceCents={product.priceCents}
          imageUrl={primaryImage?.url ?? ""}
        />
      </div>
    </div>
  );
};
