import Link from "next/link";
import { notFound } from "next/navigation";
import { getCheckoutOrders } from "@/lib/store";
import { validSandboxToken, checkoutTotalCents } from "@/lib/express-payment";
import { currency } from "@/lib/pricing";
import { PaymentButton } from "./PaymentButton";

export const dynamic = "force-dynamic";

export default async function PaymentPage({ searchParams }: { searchParams: Promise<{ checkout?: string; token?: string }> }) {
  const { checkout = "", token = "" } = await searchParams;
  if (!validSandboxToken(checkout, token)) notFound();
  const orders = await getCheckoutOrders(checkout);
  if (!orders.length || orders.some((o) => o.checkoutMode !== "express_sandbox" || o.status === "cancelled")) notFound();
  return <main className="page checkout-page"><nav className="co-progress" aria-label="Checkout progress"><Link href="/cart"><span>01</span> Cart</Link><Link href="/checkout"><span>02</span> Details</Link><span aria-current="step"><span>03</span> Payment</span></nav><section className="co-card" style={{ maxWidth: 580, margin: "0 auto" }}><p className="eyebrow">Test checkout</p><h1 className="page-title">Payment</h1><p className="hx-body">This shop is in test mode. No card details are collected and no charge will be made.</p><div className="co-total"><span>Order total</span><strong>{currency(checkoutTotalCents(orders) / 100)}</strong></div><PaymentButton checkoutId={checkout} token={token} /><p className="co-payment-note">After payment, we prepare your production proof. Production starts after your approval.</p><Link href="/cart">Return to cart</Link></section></main>;
}
