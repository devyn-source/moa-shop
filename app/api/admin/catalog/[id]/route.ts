import { NextResponse } from "next/server";
import { updateProduct } from "@/lib/store";
import type { ProductUpdateInput } from "@/lib/types";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const input = (await request.json()) as ProductUpdateInput;
    const product = await updateProduct(id, input);
    return NextResponse.json(product);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Product update failed" },
      { status: 400 }
    );
  }
}
