"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useCart, type CartItem } from "@/components/CartProvider";

const CART_EASE = [0.22, 1, 0.36, 1] as const;
import { groupCartItems } from "@/lib/bundle";
import { currency } from "@/lib/pricing";
import { PR_BOX_PROMO, isPromoWithinWindow } from "@/lib/promo";

function SingleLine({ item, onRemove }: { item: CartItem; onRemove: (id: string) => void }) {
  const sizes = Object.entries(item.sizeQty);
  return (
    <div className="cart-line">
      <Link href={`/p/${item.slug}`} className="cart-thumb" aria-label={`Reconfigure ${item.displayName}`}>
        {item.image ? (
          <>
            <Image className="cart-thumb-base" src={item.image} alt="" width={1600} height={2000} sizes="110px" />
            {item.colorHex ? (
              <span
                className="cart-thumb-tint"
                style={{
                  backgroundColor: item.colorHex,
                  WebkitMaskImage: `url("${item.image}")`,
                  maskImage: `url("${item.image}")`
                }}
              />
            ) : null}
          </>
        ) : (
          <span className="cart-line-ph">{item.skuCode}</span>
        )}
        {item.artworkFileUrl ? <img className="cart-thumb-art" src={item.artworkFileUrl} alt="" loading="lazy" /> : null}
      </Link>
      <div className="cart-line-body">
        <div className="cart-line-top">
          <div>
            <h3>{item.displayName}</h3>
            <p className="cart-line-meta">
              Style {item.skuCode} · {item.colorLabel} · {item.decorationLabel}
            </p>
          </div>
          <button type="button" className="cart-remove" onClick={() => onRemove(item.lineId)} aria-label="Remove">✕</button>
        </div>
        {sizes.length > 0 ? (
          <div className="cart-line-sizes">
            {sizes.map(([size, qty]) => (
              <span key={size} className="cart-size-chip"><b>{size}</b> {qty}</span>
            ))}
          </div>
        ) : null}
        <div className="cart-line-foot">
          <span className="cart-line-qty">
            {item.quantity.toLocaleString()} units · {currency(item.perUnitUsd + item.decorationAdderUsd)}/unit
          </span>
          <strong className="cart-line-total">{currency(item.totalUsd)}</strong>
        </div>
      </div>
    </div>
  );
}

export default function CartPage() {
  const { items, total, count, removeItem, removeBundle, hydrated } = useCart();
  const { bundles, singles } = useMemo(() => groupCartItems(items), [items]);

  return (
    <main className="page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/shop">Catalog</Link>
        <span aria-hidden>/</span>
        <span className="crumb-current">Cart</span>
      </nav>

      <div className="section-head">
        <div>
          <p className="eyebrow">Your order</p>
          <h2>Cart</h2>
        </div>
        {hydrated && items.length > 0 ? (
          <span className="label">
            {bundles.length > 0 ? `${bundles.length} box${bundles.length === 1 ? "" : "es"} · ` : ""}
            {count.toLocaleString()} units
          </span>
        ) : null}
      </div>

      {!hydrated ? (
        <div className="empty-state">Loading cart…</div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          Your cart is empty. <Link href="/shop" className="link-button">Browse the catalog →</Link>
        </div>
      ) : (
        <>
        {isPromoWithinWindow(PR_BOX_PROMO) && singles.length > 0 ? (
          <Link href="/p/pr-box" className="cart-upsell">
            <div className="cart-upsell-text">
              <span className="cart-upsell-tag">{PR_BOX_PROMO.label}</span>
              <p>
                {singles.length >= PR_BOX_PROMO.qualify.minComponents
                  ? `You've got ${singles.length} items — bundle them with branded packaging into a PR Box and save ${Math.round(PR_BOX_PROMO.discount.value * 100)}%.`
                  : `Seeding to press or influencers? Bundle ${PR_BOX_PROMO.qualify.minComponents}+ items with branded packaging into a PR Box and save ${Math.round(PR_BOX_PROMO.discount.value * 100)}%.`}
              </p>
            </div>
            <span className="cart-upsell-cta">{PR_BOX_PROMO.banner.ctaText} →</span>
          </Link>
        ) : null}
        <div className="cart-layout">
          <div className="cart-lines">
            <AnimatePresence initial={false} mode="popLayout">
            {bundles.map((bundle) => (
              <motion.div
                className="cart-bundle"
                key={bundle.bundleId}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.2, ease: CART_EASE } }}
                transition={{ duration: 0.34, ease: CART_EASE }}
              >
                <div className="cart-bundle-head">
                  <div>
                    <span className="cart-bundle-tag">{bundle.label}</span>
                    <h3>{bundle.boxQty.toLocaleString()} boxes · {currency(bundle.boxUnitUsd)}/box</h3>
                  </div>
                  <div className="cart-bundle-head-right">
                    <strong>{currency(bundle.boxTotalUsd)}</strong>
                    <button type="button" className="cart-remove" onClick={() => removeBundle(bundle.bundleId)} aria-label="Remove box">✕</button>
                  </div>
                </div>
                <ul className="cart-bundle-lines">
                  {bundle.lines.map((line) => (
                    <li key={line.lineId} className="cart-bundle-line">
                      <span className="cart-bundle-line-name">
                        {line.displayName}
                        {line.bundleRole === "packaging" ? <em> · packaging</em> : line.decorationLabel && line.decorationLabel !== "Undecorated" ? <em> · {line.colorLabel}, {line.decorationLabel}</em> : <em> · {line.colorLabel}</em>}
                        {(line.perBoxQty ?? 1) > 1 ? <b> ×{line.perBoxQty}/box</b> : null}
                      </span>
                      <span className="cart-bundle-line-price">{currency(line.perBoxUsd ?? 0)}/box</span>
                    </li>
                  ))}
                </ul>
                <div className="cart-bundle-foot">
                  <span>Per-box subtotal {currency(bundle.boxSubtotalUsd)}</span>
                  {bundle.boxDiscountUsd > 0 ? <span className="cart-bundle-save">− {currency(bundle.boxDiscountUsd)}/box bundle discount</span> : null}
                  <Link href={`/p/pr-box`} className="link-button">+ Build another box</Link>
                </div>
              </motion.div>
            ))}

            {singles.map((item) => (
              <motion.div
                key={item.lineId}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.2, ease: CART_EASE } }}
                transition={{ duration: 0.34, ease: CART_EASE }}
              >
                <SingleLine item={item} onRemove={removeItem} />
              </motion.div>
            ))}
            </AnimatePresence>

            <Link href="/" className="ghost-button cart-add-more">+ Add another SKU</Link>
          </div>

          <aside className="cart-summary panel">
            <div className="cart-summary-pad">
              <p className="eyebrow">Order summary</p>
              {bundles.length > 0 ? <div className="price-line"><span>PR Boxes</span><strong>{bundles.length}</strong></div> : null}
              {singles.length > 0 ? <div className="price-line"><span>SKUs</span><strong>{singles.length}</strong></div> : null}
              <div className="price-line"><span>Total units</span><strong>{count.toLocaleString()}</strong></div>
              <div className="price-total-big" style={{ marginTop: 14 }}>
                <span className="from-label">Order total</span>
                <span className="price-total-num">{currency(total)}</span>
                <span className="price-total-sub">pre-tax · upfront</span>
              </div>
              <Link href="/checkout" className="button button--lg button--full" style={{ marginTop: 12 }}>
                Checkout →
              </Link>
              <p className="trust-note">Each line becomes its own production order. Enter contact + ship-to once at checkout.</p>
            </div>
          </aside>
        </div>
        </>
      )}
    </main>
  );
}
