import { NextResponse } from "next/server";
import { createOrder } from "@/lib/store";
import type { OrderInput } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as OrderInput;
    const order = await createOrder(input);
    return NextResponse.json({ id: order.id, orderNumber: order.orderNumber });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Order failed" },
      { status: 400 }
    );
  }
}
