import { NextResponse } from "next/server";
import { updateOrderStatus } from "@/lib/store";
import type { OrderStatus } from "@/lib/types";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      status: OrderStatus;
      note?: string;
      trackingCarrier?: string;
      trackingNumber?: string;
      internalNotes?: string;
    };
    const order = await updateOrderStatus(id, body.status, body.note ?? "Status updated", {
      trackingCarrier: body.trackingCarrier,
      trackingNumber: body.trackingNumber,
      internalNotes: body.internalNotes
    });
    return NextResponse.json(order);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Order update failed" },
      { status: 400 }
    );
  }
}
