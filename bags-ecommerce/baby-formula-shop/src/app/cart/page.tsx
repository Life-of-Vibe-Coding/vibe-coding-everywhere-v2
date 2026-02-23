"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/components/cart-provider";
import { formatPrice } from "@/lib/formatPrice";

const CartPage = () => {
  const { items, removeItem, updateQuantity, subtotalCents, clearCart } =
    useCart();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-zinc-900">Your cart</h1>
        {items.length > 0 ? (
          <button
            type="button"
            className="text-sm font-medium text-rose-500 hover:text-rose-600"
            onClick={clearCart}
          >
            Clear cart
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-300 p-10 text-center">
          <p className="text-zinc-600">Your cart is empty.</p>
          <Link
            href="/"
            className="mt-4 inline-flex rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white"
          >
            Browse formula
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="space-y-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:flex-row"
              >
                <div className="relative h-32 w-full overflow-hidden rounded-xl bg-zinc-100 sm:w-32">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      fill
                      className="object-cover"
                    />
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-lg font-semibold text-zinc-900">
                        {item.name}
                      </p>
                      <p className="text-sm text-zinc-500">
                        {formatPrice(item.priceCents)} each
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-sm font-medium text-zinc-400 hover:text-rose-500"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-zinc-500">Qty</label>
                    <input
                      type="number"
                      min={1}
                      className="w-20 rounded-lg border border-zinc-200 px-2 py-1 text-sm"
                      value={item.quantity}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        updateQuantity(
                          item.id,
                          Number.isFinite(value) && value > 0 ? value : 1
                        );
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="h-fit rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">Order summary</h2>
            <div className="mt-4 flex items-center justify-between text-sm text-zinc-600">
              <span>Subtotal</span>
              <span>{formatPrice(subtotalCents)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm text-zinc-600">
              <span>Shipping</span>
              <span>Calculated at checkout</span>
            </div>
            <button
              type="button"
              className="mt-6 w-full rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600"
            >
              Checkout (coming soon)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CartPage;
