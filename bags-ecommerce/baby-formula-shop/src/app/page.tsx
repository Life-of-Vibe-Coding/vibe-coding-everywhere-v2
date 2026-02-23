import { prisma } from "@/lib/prisma";
import { ProductCard } from "@/components/product-card";

export const dynamic = "force-dynamic";

const HomePage = async () => {
  const products = await prisma.product.findMany({
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      category: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const featured = products.filter((product) => product.isFeatured);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-12">
      <section className="rounded-3xl bg-rose-50 p-10">
        <div className="max-w-2xl space-y-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-rose-500">
            Organic baby formula
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-zinc-900">
            Nourishing little ones with clean, science-backed formula.
          </h1>
          <p className="text-lg text-zinc-600">
            Explore curated formula blends for every stage, with transparent
            ingredients, gentle proteins, and nutrition that grows with your
            baby.
          </p>
        </div>
      </section>

      {featured.length > 0 ? (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-zinc-900">
              Featured favorites
            </h2>
            <p className="text-sm text-zinc-500">Always in stock and loved</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-zinc-900">
            Full collection
          </h2>
          <p className="text-sm text-zinc-500">{products.length} items</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  );
};

export default HomePage;
