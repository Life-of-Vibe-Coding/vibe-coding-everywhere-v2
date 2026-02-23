import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  featured: z.enum(["true", "false"]).optional(),
});

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    featured: searchParams.get("featured") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters." }, { status: 400 });
  }

  const products = await prisma.product.findMany({
    where: parsed.data.featured === "true" ? { isFeatured: true } : undefined,
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      category: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: products });
};
