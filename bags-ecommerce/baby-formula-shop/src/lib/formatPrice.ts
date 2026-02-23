export const formatPrice = (priceCents: number) => {
  if (!Number.isFinite(priceCents) || priceCents < 0) {
    throw new Error("Price must be a non-negative number of cents.");
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(priceCents / 100);
};
