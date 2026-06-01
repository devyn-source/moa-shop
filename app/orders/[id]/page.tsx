import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderTracker } from "@/components/OrderTracker";
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
      <p className="eyebrow">Order {order.orderNumber}</p>

      <section className="tracker-hero">
        <OrderTracker order={order} />
      </section>

      <section style={{ marginTop: 28, maxWidth: 480 }}>
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
            <strong>
              {order.artworkFileUrl ? (
                <a href={order.artworkFileUrl} target="_blank" rel="noreferrer" className="link-button">
                  {order.artworkFileName} ↗
                </a>
              ) : (
                order.artworkFileName
              )}
            </strong>
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
