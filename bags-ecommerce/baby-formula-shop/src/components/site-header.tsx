"use client";

import Link from "next/link";
import { useCart } from "./cart-provider";

export const SiteHeader = () => {
  const { totalItems } = useCart();

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="text-xl font-semibold text-zinc-900">
          NutriNest Formula
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium text-zinc-600">
          <Link href="/" className="transition hover:text-zinc-900">
            Shop
          </Link>
          <Link href="/cart" className="transition hover:text-zinc-900">
            Cart ({totalItems})
          </Link>
        </nav>
      </div>
    </header>
  );
};
