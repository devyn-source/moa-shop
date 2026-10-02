import Link from "next/link";
import { notFound } from "next/navigation";
import { getCheckoutOrders } from "@/lib/store";
import { validSandboxToken, checkoutTotalCents } from "@/lib/express-payment";
import { currency } from "@/lib/pricing";
import { CartClear } from "@/components/CartClear";
import { CheckoutRefresh } from "./CheckoutRefresh";

export async function PaidCheckout({ checkoutId, token, sessionId }: { checkoutId: string; token?: string; sessionId?: string }) {
  const orders = await getCheckoutOrders(checkoutId);
  if (!orders.length) notFound();
  const sandbox = orders.every((o) => o.checkoutMode === "express_sandbox");
  if (sandbox ? !validSandboxToken(checkoutId, token ?? "") : !sessionId || !orders.every((o) => o.stripeSessionId === sessionId)) notFound();
  const paid = orders.every((o) => o.paymentStatus === "paid" || o.paymentStatus === "simulated_paid");
  const number = orders[0].fulfillment?.catalogOrderId;
  return <main className="page checkout-page">
    {paid ? <CartClear /> : null}
    <header className="co-heading"><p className="eyebrow">{paid ? sandbox ? "Test payment confirmed" : "Payment received" : "Confirming your payment"}</p><h1 className="hx-h2">{paid ? "Your order is in." : "One moment."}</h1><p className="hx-body">{paid ? "We are checking your artwork and preparing your production proof. Review it in your account before anything is made." : "We are waiting for payment confirmation. You can check the status here without paying again."}</p></header>
    <section className="co-card" style={{ maxWidth: 680 }}><div className="co-total"><span>{number || "Your order"}</span><strong>{currency(checkoutTotalCents(orders) / 100)}</strong></div>
      {paid && number ? <><p className="hx-body">Your proof will be ready within 24 business hours. Approve it or request a change from your account.</p><Link className="button" href={`/orders/express/${encodeURIComponent(number)}`}>View your order</Link></> : <><p className="hx-body">{paid ? "Payment is confirmed. We are finishing your order details. No further payment is needed." : "Your cart stays saved until payment is confirmed."}</p><CheckoutRefresh /></>}
    </section>
  </main>;
}
