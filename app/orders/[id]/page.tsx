import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusTimeline } from "@/components/StatusTimeline";
import { currency } from "@/lib/pricing";
import { getOrderById, getProductById, statusLabel } from "@/lib/store";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrderById(id);

  if (!order) {
    notFound();
  }

  const product = await getProductById(order.productId);

  return (
    <main className="page">
      <p className="eyebrow">Order received</p>
      <h1 className="page-title" style={{ fontSize: "clamp(44px, 7vw, 92px)" }}>
        {order.orderNumber}
      </h1>
      <p className="lede">
        Your order is paid and now sits in MOA artwork QA. The current status is{" "}
        <strong>{statusLabel(order.status)}</strong>.
      </p>

      <section className="config-shell" style={{ marginTop: 42 }}>
        <div className="panel panel-pad">
          <h2>Production Timeline</h2>
          <StatusTimeline order={order} />
        </div>
        <aside className="panel panel-pad">
          <p className="eyebrow">Order Summary</p>
          <div className="order-line">
            <span>Product</span>
            <strong>{product?.displayName ?? "Catalog product"}</strong>
          </div>
          <div className="order-line">
            <span>Quantity</span>
            <strong>{order.quantity.toLocaleString()}</strong>
          </div>
          <div className="order-line">
            <span>Artwork</span>
            <strong>{order.artworkFileName}</strong>
          </div>
          <div className="order-line">
            <span>Status</span>
            <strong>{statusLabel(order.status)}</strong>
          </div>
          <div className="price-total">
            <span>Total paid</span>
            <span>{currency(order.totalUsd)}</span>
          </div>
          {order.trackingNumber ? (
            <p>
              Tracking: {order.trackingCarrier} {order.trackingNumber}
            </p>
          ) : null}
          <div className="action-row">
            <Link className="secondary-button" href="/">
              Back to catalog
            </Link>
          </div>
        </aside>
      </section>
    </main>
  );
}
