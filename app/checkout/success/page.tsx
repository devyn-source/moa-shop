import Link from "next/link";
import { OrderTracker } from "@/components/OrderTracker";
import { CartClear } from "@/components/CartClear";
import { currency } from "@/lib/pricing";
import { getOrderById } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({
  searchParams
}: {
  searchParams: Promise<{ orders?: string }>;
}) {
  const params = await searchParams;
  const ids = (params.orders ?? "").split(",").filter(Boolean);
  const fetched = await Promise.all(ids.map((id) => getOrderById(id)));
  const orders = fetched.filter((o): o is NonNullable<typeof o> => o !== null);
  const total = orders.reduce((s, o) => s + o.totalUsd, 0);
  const units = orders.reduce((s, o) => s + o.quantity, 0);

  return (
    <main className="page">
      <CartClear />

      <header className="success-head">
        <p className="eyebrow">Payment received</p>
        <h1 className="success-headline">We&apos;ve got your order</h1>
        <p className="success-lede">
          {orders.length || "Your"} {orders.length === 1 ? "order is" : "orders are"} confirmed and routed to MOA artwork
          QA. You&apos;ll get tracking the moment they ship.
        </p>
        {orders.length ? (
          <p className="success-summary">
            {orders.length} {orders.length === 1 ? "SKU" : "SKUs"} · {units.toLocaleString()} total units ·{" "}
            <strong>{currency(total)}</strong>
          </p>
        ) : null}
      </header>

      {orders.length ? (
        <section className="success-orders">
          {orders.map((order) => (
            <article key={order.id} className="success-order">
              <header className="success-order-head">
                <div>
                  <p className="eyebrow">{order.orderNumber}</p>
                  <p className="success-order-meta">
                    {order.quantity.toLocaleString()} units · {currency(order.totalUsd)}
                  </p>
                </div>
                <Link href={`/orders/${order.id}`} className="success-order-link">
                  Track →
                </Link>
              </header>
              <div className="tracker-hero">
                <OrderTracker order={order} compact />
              </div>
            </article>
          ))}
        </section>
      ) : null}

      <section className="success-next">
        <p className="eyebrow">What happens next</p>
        <ol className="success-steps">
          <li>
            <span className="success-step-num">01</span>
            <div>
              <h3>Artwork QA</h3>
              <p>MOA reviews your art, mockup, and production specs. Usually 1–3 business days.</p>
            </div>
          </li>
          <li>
            <span className="success-step-num">02</span>
            <div>
              <h3>Production</h3>
              <p>Once approved, your run goes into production with MOA quality control end-to-end.</p>
            </div>
          </li>
          <li>
            <span className="success-step-num">03</span>
            <div>
              <h3>Ship</h3>
              <p>Tracking lands in your inbox. The tracker on this site keeps you posted in real time.</p>
            </div>
          </li>
        </ol>
      </section>

      <div className="action-row" style={{ marginTop: 28 }}>
        <Link href="/" className="button">
          Back to catalog
        </Link>
      </div>
    </main>
  );
}
