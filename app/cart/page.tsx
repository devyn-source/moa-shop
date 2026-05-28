"use client";

import Link from "next/link";
import { useCart } from "@/components/CartProvider";
import { currency } from "@/lib/pricing";

export default function CartPage() {
  const { items, total, count, removeItem, hydrated } = useCart();

  return (
    <main className="page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Catalog</Link>
        <span aria-hidden>/</span>
        <span className="crumb-current">Cart</span>
      </nav>

      <div className="section-head">
        <div>
          <p className="eyebrow">Your order</p>
          <h2>Cart</h2>
        </div>
        {hydrated && items.length > 0 ? (
          <span className="label">{items.length} {items.length === 1 ? "SKU" : "SKUs"} · {count.toLocaleString()} units</span>
        ) : null}
      </div>

      {!hydrated ? (
        <div className="empty-state">Loading cart…</div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          Your cart is empty. <Link href="/" className="link-button">Browse the catalog →</Link>
        </div>
      ) : (
        <div className="cart-layout">
          <div className="cart-lines">
            {items.map((item) => {
              const sizes = Object.entries(item.sizeQty);
              return (
                <div className="cart-line" key={item.lineId}>
                  <div className={`cart-line-visual${item.image ? " cart-line-visual--photo" : ""}`}>
                    {item.image ? <img src={item.image} alt={item.displayName} loading="lazy" /> : <span className="cart-line-ph">{item.skuCode}</span>}
                  </div>
                  <div className="cart-line-body">
                    <div className="cart-line-top">
                      <div>
                        <h3>{item.displayName}</h3>
                        <p className="cart-line-meta">
                          Style {item.skuCode} · {item.colorLabel} · {item.decorationLabel}
                        </p>
                      </div>
                      <button type="button" className="cart-remove" onClick={() => removeItem(item.lineId)} aria-label="Remove">✕</button>
                    </div>
                    <div className="cart-line-sizes">
                      {sizes.map(([size, qty]) => (
                        <span key={size} className="cart-size-chip"><b>{size}</b> {qty}</span>
                      ))}
                    </div>
                    <div className="cart-line-foot">
                      <span className="cart-line-qty">{item.quantity.toLocaleString()} units · {currency(item.perUnitUsd + item.decorationAdderUsd)}/unit</span>
                      <strong className="cart-line-total">{currency(item.totalUsd)}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
            <Link href="/" className="ghost-button cart-add-more">+ Add another SKU</Link>
          </div>

          <aside className="cart-summary panel">
            <div className="cart-summary-pad">
              <p className="eyebrow">Order summary</p>
              <div className="price-line"><span>SKUs</span><strong>{items.length}</strong></div>
              <div className="price-line"><span>Total units</span><strong>{count.toLocaleString()}</strong></div>
              <div className="price-line"><span>Before decoration adders</span><strong>—</strong></div>
              <div className="price-total-big" style={{ marginTop: 14 }}>
                <span className="from-label">Order total</span>
                <span className="price-total-num">{currency(total)}</span>
                <span className="price-total-sub">pre-tax · upfront</span>
              </div>
              <Link href="/checkout" className="button button--lg button--full" style={{ marginTop: 12 }}>
                Checkout →
              </Link>
              <p className="trust-note">Each SKU becomes its own production order. Enter contact + ship-to once at checkout.</p>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
