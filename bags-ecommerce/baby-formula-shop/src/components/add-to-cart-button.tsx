"use client";

import { useCart } from "./cart-provider";

type AddToCartButtonProps = {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  imageUrl: string;
};

export const AddToCartButton = ({
  id,
  name,
  slug,
  priceCents,
  imageUrl,
}: AddToCartButtonProps) => {
  const { addItem } = useCart();

  return (
    <button
      type="button"
      className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
      onClick={() => addItem({ id, name, slug, priceCents, imageUrl })}
    >
      Add to cart
    </button>
  );
};
