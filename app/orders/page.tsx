import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { getOrdersByEmail, getProducts, statusLabel } from "@/lib/store";
import { currency } from "@/lib/pricing";
import { ReorderButton } from "@/components/ReorderButton";
import type { CatalogProduct, ShopOrder } from "@/lib/types";
import type { CartItem } from "@/components/CartProvider";

export const dynamic = "force-dynamic";

// Rebuild a past order's exact config into a reorderable cart item.
function reorderFrom(order: ShopOrder, product: CatalogProduct | undefined): Omit<CartItem, "lineId"> | null {
  if (!product) return null;
  const variant = product.variants.find((v) => v.id === order.variantId);
  return {
    productId: order.productId,
    slug: product.slug,
    displayName: product.displayName,
    skuCode: product.skuCode,
    variantId: order.variantId,
    colorLabel: variant?.colorLabel ?? "",
    colorHex: variant?.colorHex,
    image: product.greyFront ?? variant?.frontImage,
    decorationIds: order.decorationIds as string[],
    decorationLabel: product.decorations.filter((d) => order.decorationIds.includes(d.id)).map((d) => d.label).join(" + ") || "Undecorated",
    sizeQty: order.sizeBreakdown ?? {},
    quantity: order.quantity,
    perUnitUsd: order.perUnitUsd,
    decorationAdderUsd: order.decorationAdderUsd,
    subtotalUsd: order.subtotalUsd,
    totalUsd: order.totalUsd,
    artworkFileName: order.artworkFileName,
    artworkFileUrl: order.artworkFileUrl,
    artworkNotes: order.artworkNotes,
    artworkPlacement: order.artworkPlacement
  };
}

export default async function OrdersPage() {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) {
    redirect("/sign-in");
  }

  const [orders, products] = await Promise.all([getOrdersByEmail(email), getProducts({ includeDrafts: true })]);
  const nameById = new Map(products.map((p) => [p.id, p.displayName]));
  const productById = new Map(products.map((p) => [p.id, p]));

  return (
    <main className="page">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p className="eyebrow" style={{ color: "var(--color-terracotta)" }}>Your account</p>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: "1.8rem",
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              color: "var(--color-charcoal)",
              margin: "6px 0 0"
            }}
          >
            Your orders
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-neutral)", margin: "6px 0 0" }}>{email}</p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 28 }}>
          No orders under this email yet.{" "}
          <Link href="/shop" style={{ color: "var(--color-terracotta)" }}>Browse the catalog →</Link>
        </div>
      ) : (
        <div className="ol-list">
          {orders.map((order) => {
            const reorder = reorderFrom(order, productById.get(order.productId));
            return (
              <div key={order.id} className="ol-card">
                <div className="ol-top">
                  <div className="ol-info">
                    <Link href={`/orders/${order.id}`} className="ol-title">{nameById.get(order.productId) ?? "Catalog product"}</Link>
                    <p className="ol-meta">{order.orderNumber} · {order.quantity.toLocaleString()} units · {new Date(order.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className={`ol-badge ol-badge--${order.status}`}>{statusLabel(order.status)}</span>
                </div>
                <div className="ol-foot">
                  <span className="ol-price">{currency(order.totalUsd)}</span>
                  <div className="ol-actions">
                    {reorder ? <ReorderButton item={reorder} compact /> : null}
                    <Link href={`/orders/${order.id}`} className="ol-track">Track →</Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
