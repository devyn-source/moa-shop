import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { getOrdersByEmail, getProducts, statusLabel, bundleStatus } from "@/lib/store";
import { listSharedConfigsByEmail } from "@/lib/shared-config";
import { listWishlistSlugs } from "@/lib/wishlist";
import { currency } from "@/lib/pricing";
import { ReorderButton } from "@/components/ReorderButton";
import { ReorderBundleButton } from "@/components/ReorderBundleButton";
import { ProductCard } from "@/components/ProductCard";
import { reorderFrom } from "@/lib/reorder";
import type { ShopOrder } from "@/lib/types";
import type { CartItem } from "@/components/CartProvider";

export const dynamic = "force-dynamic";

type OrderRow = { type: "single"; order: ShopOrder } | { type: "bundle"; id: string; label: string; orders: ShopOrder[] };

// Collapse PR Box lines (sharing a bundleId) into one row, preserving list order.
function groupOrders(orders: ShopOrder[]): OrderRow[] {
  const seen = new Set<string>();
  const rows: OrderRow[] = [];
  for (const o of orders) {
    if (o.bundleId) {
      if (seen.has(o.bundleId)) continue;
      seen.add(o.bundleId);
      rows.push({ type: "bundle", id: o.bundleId, label: o.bundleLabel ?? "PR Box", orders: orders.filter((x) => x.bundleId === o.bundleId) });
    } else {
      rows.push({ type: "single", order: o });
    }
  }
  return rows;
}

export default async function OrdersPage() {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) {
    redirect("/sign-in");
  }

  const [orders, products, savedDesigns, wishlistSlugs] = await Promise.all([
    getOrdersByEmail(email),
    getProducts({ includeDrafts: true }),
    listSharedConfigsByEmail(email),
    listWishlistSlugs(email)
  ]);
  const nameById = new Map(products.map((p) => [p.id, p.displayName]));
  const productById = new Map(products.map((p) => [p.id, p]));
  const productBySlug = new Map(products.map((p) => [p.slug, p]));
  // Wishlist cards link to PDPs — only published products get a card.
  const wishlistProducts = wishlistSlugs
    .map((slug) => productBySlug.get(slug))
    .filter((p): p is NonNullable<typeof p> => Boolean(p && p.isPublished));

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
          {groupOrders(orders).map((row) => {
            if (row.type === "bundle") {
              const total = row.orders.reduce((s, o) => s + (o.totalUsd ?? 0), 0);
              const status = bundleStatus(row.orders);
              const first = row.orders[0];
              const lines = row.orders.map((o) => reorderFrom(o, productById.get(o.productId))).filter(Boolean) as Omit<CartItem, "lineId">[];
              return (
                <div key={row.id} className="ol-card ol-card--box">
                  <div className="ol-top">
                    <div className="ol-info">
                      <Link href={`/orders/${first.id}`} className="ol-title">{row.label} <span className="ol-box-tag">{row.orders.length} pieces</span></Link>
                      <p className="ol-meta">{first.orderNumber} · {new Date(first.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className={`ol-badge ol-badge--${status}`}>{statusLabel(status)}</span>
                  </div>
                  <div className="ol-foot">
                    <span className="ol-price">{currency(total)}</span>
                    <div className="ol-actions">
                      {lines.length ? <ReorderBundleButton lines={lines} compact /> : null}
                      <Link href={`/orders/${first.id}`} className="ol-track">Track →</Link>
                    </div>
                  </div>
                </div>
              );
            }
            const order = row.order;
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

      {/* Saved designs — shared configs + wishlist hearts, quiet, below orders. */}
      <section className="sd-section" aria-label="Saved designs">
        <h2 className="sd-title">Saved designs</h2>
        {savedDesigns.length === 0 && wishlistProducts.length === 0 ? (
          <p className="sd-empty">
            Nothing saved yet — designs you share and products you heart land here.{" "}
            <Link href="/shop" style={{ color: "var(--color-terracotta)" }}>Browse the catalog →</Link>
          </p>
        ) : (
          <>
            {savedDesigns.length > 0 ? (
              <div className="sd-list">
                {savedDesigns.map((d) => {
                  const product = productBySlug.get(d.slug);
                  const variantId = typeof d.config.variantId === "string" ? d.config.variantId : null;
                  const variant = variantId ? product?.variants.find((v) => v.id === variantId) : undefined;
                  return (
                    <div key={d.id} className="sd-card">
                      <div>
                        <p className="sd-name">{product?.displayName ?? "Catalog product"}</p>
                        <p className="sd-meta">
                          {variant ? (
                            <>
                              <span className="sd-chip" style={{ background: variant.colorHex }} aria-hidden />
                              {variant.colorLabel} ·{" "}
                            </>
                          ) : null}
                          {new Date(d.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Link href={`/c/${d.id}`} className="sd-resume">Resume →</Link>
                    </div>
                  );
                })}
              </div>
            ) : null}
            {wishlistProducts.length > 0 ? (
              <div className="sd-group">
                <p className="sd-group-label">Wishlist</p>
                <div className="sd-wish-grid">
                  {wishlistProducts.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
