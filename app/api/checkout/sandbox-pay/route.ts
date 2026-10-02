import { NextResponse } from "next/server";
import { completeExpressPayment, validSandboxToken, checkoutTotalCents } from "@/lib/express-payment";
import { getCheckoutOrders } from "@/lib/store";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  if (process.env.EXPRESS_SANDBOX !== "1") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await rateLimit("checkout", clientIp(request)))) return NextResponse.json({ error: "Please wait a moment and try again." }, { status: 429 });
  const { checkoutId, token } = await request.json().catch(() => ({}));
  if (typeof checkoutId !== "string" || typeof token !== "string" || !validSandboxToken(checkoutId, token)) return NextResponse.json({ error: "This test checkout has expired. Return to your cart to continue." }, { status: 400 });
  try {
    const orders = await getCheckoutOrders(checkoutId);
    if (!orders.length || orders.some((o) => o.status === "cancelled")) return NextResponse.json({ error: "Checkout is no longer available. Your cart is saved." }, { status: 409 });
    await completeExpressPayment(checkoutId, { method: "sandbox", id: `sandbox_${checkoutId}`, amountUsd: checkoutTotalCents(orders) / 100, paidAt: new Date().toISOString() });
    return NextResponse.json({ url: `/checkout/success?checkout=${encodeURIComponent(checkoutId)}&token=${encodeURIComponent(token)}` });
  } catch (error) {
    console.error("[express] sandbox payment handoff", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "The test payment could not finish. Please retry. No real charge was made." }, { status: 502 });
  }
}
