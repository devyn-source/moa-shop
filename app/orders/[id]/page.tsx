import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderTracker } from "@/components/OrderTracker";
import { ReorderButton } from "@/components/ReorderButton";
import { ReorderBundleButton } from "@/components/ReorderBundleButton";
import { ProductShot } from "@/components/ProductShot";
import { currency } from "@/lib/pricing";
import { reorderFrom } from "@/lib/reorder";
import { getOrderById, getOrdersByBundle, getProductById, statusLabel, bundleStatus } from "@/lib/store";
import { currentCustomerEmail, ownsOrder } from "@/lib/order-access";
import type { CatalogProduct, ShopOrder } from "@/lib/types";

// One order's premium receipt: proof/mockup + spec + downloadable files + pricing.
// Used standalone (a single order) and stacked inside a PR Box detail view.
function OrderReceiptCard({ order, product, showActions }: { order: ShopOrder; product: CatalogProduct | undefined; showActions: boolean }) {
  const variant = product?.variants.find((v) => v.id === order.variantId);
  const decorationLabel =
    (product?.decorations.filter((d) => order.decorationIds.includes(d.id)).map((d) => d.label).join(" + ")) || "Undecorated";
  const sizeRun = Object.entries(order.sizeBreakdown ?? {}).filter(([, n]) => (n ?? 0) > 0);
  // Collect every artwork file (per-placement first, then the order-level file), de-duped.
  const seenUrls = new Set<string>();
  const files = [
    ...(order.artworkPlacements ?? [])
      .filter((p) => p.artworkFileUrl)
      .map((p) => ({ name: p.artworkFileName ?? "Artwork", url: p.artworkFileUrl as string, zone: p.zoneLabel as string | undefined })),
    ...(order.artworkFileUrl ? [{ name: order.artworkFileName ?? "Artwork", url: order.artworkFileUrl, zone: undefined }] : [])
  ].filter((f) => f.url && !seenUrls.has(f.url) && seenUrls.add(f.url));
  const reorderItem = reorderFrom(order, product);

  return (
    <section className="ord">
      <div className="ord-grid">
        {/* mockup / proof */}
        <div className="ord-mockup">
          {order.proofUrl ? (
            <img src={order.proofUrl} alt={`${product?.displayName ?? "Order"} proof`} />
          ) : product ? (
            <ProductShot product={product} variant={variant} view="front" />
          ) : null}
        </div>

        {/* details */}
        <div className="ord-detail">
          <div className="ord-head">
            <span className="ord-sku">{product?.skuCode ?? "Catalog"}</span>
            <h2 className="ord-title">{product?.displayName ?? "Catalog product"}</h2>
            <span className={`ord-status ord-status--${order.status}`}>{statusLabel(order.status)}</span>
          </div>

          <dl className="ord-specs">
            <div>
              <dt>Color</dt>
              <dd>
                {variant ? (
                  <>
                    <span className="ord-swatch" style={{ background: variant.colorHex }} aria-hidden />
                    {variant.colorLabel}
                  </>
                ) : "—"}
              </dd>
            </div>
            <div><dt>Decoration</dt><dd>{decorationLabel}</dd></div>
            <div><dt>Quantity</dt><dd>{order.quantity.toLocaleString()} units</dd></div>
          </dl>

          {sizeRun.length ? (
            <div className="ord-sizes">
              {sizeRun.map(([s, n]) => (
                <span key={s} className="ord-size-chip"><b>{s}</b> {n}</span>
              ))}
            </div>
          ) : null}

          {files.length ? (
            <div className="ord-files">
              <p className="ord-files-label">Artwork files</p>
              {files.map((f, i) => (
                <a key={i} href={f.url} target="_blank" rel="noreferrer" className="ord-file">
                  <span className="ord-file-name">{f.name}{f.zone ? <em> · {f.zone}</em> : null}</span>
                  <span className="ord-file-dl" aria-hidden>↓</span>
                </a>
              ))}
            </div>
          ) : null}

          <div className="ord-pricing">
            <div className="ord-price-line"><span>Per unit</span><span>{currency(order.perUnitUsd)}</span></div>
            {order.decorationAdderUsd ? (
              <div className="ord-price-line"><span>Decoration</span><span>{currency(order.decorationAdderUsd)}/unit</span></div>
            ) : null}
            {order.taxUsd ? (
              <div className="ord-price-line"><span>Tax</span><span>{currency(order.taxUsd)}</span></div>
            ) : null}
            <div className="ord-total"><span>{showActions ? "Total paid" : "Line total"}</span><strong>{currency(order.totalUsd)}</strong></div>
          </div>

          {order.trackingNumber ? (
            <div className="ord-tracking">
              <span className="ord-tracking-label">Tracking</span>
              <strong>{order.trackingCarrier} · {order.trackingNumber}</strong>
            </div>
          ) : null}

          {showActions ? (
            <div className="ord-actions">
              {reorderItem ? <ReorderButton item={reorderItem} /> : null}
              <Link className="secondary-button" href="/shop">Back to catalog</Link>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrderById(id);

  if (!order) {
    notFound();
  }

  // Authorization: this order must belong to the signed-in customer. (Route is
  // already sign-in gated by proxy.ts; here we enforce ownership so nobody can
  // read another customer's order by changing the id.)
  const email = await currentCustomerEmail();
  if (!ownsOrder(order, email)) {
    notFound();
  }

  // --- PR Box: render the whole box (one tracker + every line) ---
  if (order.bundleId) {
    const lines = await getOrdersByBundle(order.bundleId);
    const products = (await Promise.all(lines.map((l) => getProductById(l.productId)))).map((p) => p ?? undefined);
    const status = bundleStatus(lines);
    const total = lines.reduce((s, o) => s + (o.totalUsd ?? 0), 0);
    const label = order.bundleLabel ?? "PR Box";
    const rep = { ...lines[0], status }; // representative order for the tracker
    const reorderLines = lines.map((l, i) => reorderFrom(l, products[i])).filter(Boolean) as NonNullable<ReturnType<typeof reorderFrom>>[];

    return (
      <main className="page">
        <p className="eyebrow">{label} · {lines.length} pieces</p>

        <section className="tracker-hero">
          <OrderTracker order={rep} />
        </section>

        <div className="ord-box-head">
          <h2>{label}</h2>
          <span className="ord-box-sum">{lines.length} pieces · <strong>{currency(total)}</strong></span>
        </div>

        <div className="ord-box-stack">
          {lines.map((l, i) => (
            <OrderReceiptCard key={l.id} order={l} product={products[i]} showActions={false} />
          ))}
        </div>

        <div className="ord-actions ord-box-actions">
          {reorderLines.length ? <ReorderBundleButton lines={reorderLines} label="Reorder box →" /> : null}
          <Link className="secondary-button" href="/shop">Back to catalog</Link>
        </div>
      </main>
    );
  }

  // --- Single order ---
  const product = (await getProductById(order.productId)) ?? undefined;
  return (
    <main className="page">
      <p className="eyebrow">Order {order.orderNumber}</p>

      <section className="tracker-hero">
        <OrderTracker order={order} />
      </section>

      <OrderReceiptCard order={order} product={product} showActions />
    </main>
  );
}
