import { NextResponse } from "next/server";
import { currentCustomerEmail } from "@/lib/order-access";
import { cancelExpressCheckout, RefundError } from "@/lib/express-refunds";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const email = await currentCustomerEmail();
  if (!email) return NextResponse.json({ error: "Sign in to manage your order" }, { status: 401 });
  if (!(await rateLimit("update", clientIp(request)))) return NextResponse.json({ error: "Please wait a moment and retry" }, { status: 429 });
  const body = await request.json().catch(() => null);
  if (typeof body?.number !== "string" || !body.number || body.number.length > 80) return NextResponse.json({ error: "Invalid order" }, { status: 400 });
  try {
    const refund = await cancelExpressCheckout(body.number, email);
    return NextResponse.json({ ok: true, status: refund.status, refundId: refund.refund_id }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof RefundError ? error.message : "Cancellation needs retry. Check your order before trying again." }, { status: error instanceof RefundError ? error.status : 503 });
  }
}
