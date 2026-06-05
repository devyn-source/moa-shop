import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderTracker } from "@/components/OrderTracker";
import { ReorderButton } from "@/components/ReorderButton";
import { currency } from "@/lib/pricing";
import { getOrderById, getProductById, statusLabel } from "@/lib/store";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrderById(id);

  if (!order) {
    notFound();
  }

  const product = await getProductById(order.productId);
  const variant = product?.variants.find((v) => v.id === order.variantId);
  const reorderItem = product
    ? {
        productId: order.productId,
        slug: product.slug,
        displayName: product.displayName,
        skuCode: product.skuCode,
        variantId: order.variantId,
        colorLabel: variant?.colorLabel ?? "",
        colorHex: variant?.colorHex,
        image: product.greyFront ?? variant?.frontImage,
        decorationIds: order.decorationIds as string[],
        decorationLabel:
          product.decorations.filter((d) => order.decorationIds.includes(d.id)).map((d) => d.label).join(" + ") || "Undecorated",
        sizeQty: order.sizeBreakdown ?? {},
        quantity: order.quantity,
        perUnitUsd: order.perUnitUsd,
        decorationAdderUsd: order.decorationAdderUsd,
        subtotalUsd: order.subtotalUsd,
        totalUsd: order.totalUsd,
        artworkFileName: order.artworkFileName,
        artworkFileUrl: order.artworkFileUrl,
        artworkNotes: order.artworkNotes,
        artworkPlacement: order.artworkPlacement,
      }
    : null;

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
            {reorderItem ? <ReorderButton item={reorderItem} /> : null}
            <Link className="secondary-button" href="/">
              Back to catalog
            </Link>
          </div>
        </aside>
      </section>
    </main>
  );
}
