import { NextResponse } from "next/server";
import { updateProduct } from "@/lib/store";
import { adminProductUpdateSchema } from "@/lib/validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const parsed = adminProductUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid product update" }, { status: 400 });
    }
    const product = await updateProduct(id, parsed.data);
    return NextResponse.json(product);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Product update failed" },
      { status: 400 }
    );
  }
}
