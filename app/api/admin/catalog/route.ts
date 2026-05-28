import { NextResponse } from "next/server";
import { createProduct } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as { displayName: string; headline?: string; moq?: number };
    const product = await createProduct(input);
    return NextResponse.json({ id: product.id, slug: product.slug });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Product create failed" },
      { status: 400 }
    );
  }
}
