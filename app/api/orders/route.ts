import { NextResponse } from "next/server";
import { createOrder } from "@/lib/store";
import { currentCustomerEmail } from "@/lib/order-access";
import { apiError } from "@/lib/errors";
import type { OrderInput } from "@/lib/types";

export async function POST(request: Request) {
  try {
    // Checkout is the real order path; this guards against anonymous order spam.
    const email = await currentCustomerEmail();
    if (!email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const input = (await request.json()) as OrderInput;
    if (input.contactEmail?.trim().toLowerCase() !== email) return NextResponse.json({ error: "Use your signed-in account email" }, { status: 400 });
    const order = await createOrder({ ...input, contactEmail: email });
    return NextResponse.json({ id: order.id, orderNumber: order.orderNumber });
  } catch (error) {
    return apiError(error, { fallback: "Order failed.", status: 400 });
  }
}
