import Link from "next/link";
import { OrderTracker } from "@/components/OrderTracker";
import { CartClear } from "@/components/CartClear";
import { currency } from "@/lib/pricing";
import { getOrderById } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({
  searchParams
}: {
  searchParams: Promise<{ orders?: string; express?: string }>;
}) {
  const params = await searchParams;
  const ids = (params.orders ?? "").split(",").filter(Boolean);
  const fetched = await Promise.all(ids.map((id) => getOrderById(id)));
  const orders = fetched.filter((o): o is NonNullable<typeof o> => o !== null);
  const total = orders.reduce((s, o) => s + o.totalUsd, 0);
  const units = orders.reduce((s, o) => s + o.quantity, 0);
  const expressNumber = params.express || null;

  return (
    <main className="page">
      <CartClear />

      <header className="success-head">
        <p className="eyebrow">{expressNumber ? `Order ${expressNumber} submitted` : "Payment received"}</p>
        <h1 className="success-headline">We&apos;ve got your order</h1>
        {expressNumber ? (
          <p className="success-lede">
            Your mockups are below. MOA checks every placement and sends your proof with one invoice for the full
            order within 24 business hours. Approve the proof and pay the invoice, and production starts that day.
          </p>
        ) : (
          <p className="success-lede">
            {orders.length || "Your"} {orders.length === 1 ? "order is" : "orders are"} confirmed and routed to MOA artwork
            QA. You&apos;ll get tracking the moment they ship.
          </p>
        )}
        {expressNumber ? (
          <p className="success-summary">
            <Link href={`/orders/express/${encodeURIComponent(expressNumber)}`}><strong>Follow your order, proof and invoice in your account</strong></Link>
          </p>
        ) : null}
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
              {expressNumber && order.proofUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={order.proofUrl} alt={`Mockup for ${order.orderNumber}`} className="success-proof" style={{ width: "100%", height: "auto", borderRadius: 10 }} />
              ) : (
                <div className="tracker-hero">
                  <OrderTracker order={order} compact />
                </div>
              )}
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
              <h3>{expressNumber ? "Proof and invoice" : "Artwork QA"}</h3>
              <p>{expressNumber ? "Within 24 business hours: your proof for every piece and one invoice for the full order." : "MOA reviews your art, mockup, and production specs. Usually 1 to 3 business days."}</p>
            </div>
          </li>
          <li>
            <span className="success-step-num">02</span>
            <div>
              <h3>Production</h3>
              <p>{expressNumber ? "Approve the proof and pay the invoice, and your run goes into production that day." : "Once approved, your run goes into production with MOA quality control end to end."}</p>
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
