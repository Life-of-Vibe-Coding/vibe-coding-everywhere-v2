import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const paramsSchema = z.object({
  slug: z.string().min(1).max(120),
});

export const GET = async (
  _request: Request,
  { params }: { params: { slug: string } }
) => {
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid product slug." }, { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { slug: parsed.data.slug },
    include: { images: { orderBy: { sortOrder: "asc" } }, category: true },
  });

  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  return NextResponse.json({ data: product });
};
