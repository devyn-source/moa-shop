import { NextResponse } from "next/server";
import { createProduct } from "@/lib/store";
import { adminProductCreateSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const parsed = adminProductCreateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid product input" }, { status: 400 });
    }
    const product = await createProduct(parsed.data);
    return NextResponse.json({ id: product.id, slug: product.slug });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Product create failed" },
      { status: 400 }
    );
  }
}
