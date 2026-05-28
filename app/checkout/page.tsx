"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/CartProvider";
import { currency } from "@/lib/pricing";

type Created = { orderNumber: string; id: string; displayName: string };

export default function CheckoutPage() {
  const { items, total, count, clear, hydrated } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Created[] | null>(null);

  async function submit(formData: FormData) {
    setSubmitting(true);
    setError("");

    const contact = {
      contactName: String(formData.get("contactName") ?? ""),
      contactEmail: String(formData.get("contactEmail") ?? ""),
      contactPhone: String(formData.get("contactPhone") ?? ""),
      companyName: String(formData.get("companyName") ?? ""),
      shipToName: String(formData.get("shipToName") ?? ""),
      shipToAddress: {
        line1: String(formData.get("line1") ?? ""),
        line2: String(formData.get("line2") ?? ""),
        city: String(formData.get("city") ?? ""),
        state: String(formData.get("state") ?? ""),
        postalCode: String(formData.get("postalCode") ?? ""),
        country: String(formData.get("country") ?? "United States")
      }
    };

    const results: Created[] = [];
    for (const item of items) {
      const sizeSummary = Object.entries(item.sizeQty).map(([s, q]) => `${s}:${q}`).join(" ");
      const payload = {
        ...contact,
        productId: item.productId,
        variantId: item.variantId,
        decorationId: item.decorationId,
        quantity: item.quantity,
        artworkFileName: item.artworkFileName,
        artworkNotes: sizeSummary ? `Sizes — ${sizeSummary}${item.artworkNotes ? `\n\n${item.artworkNotes}` : ""}` : item.artworkNotes
      };
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        setSubmitting(false);
        setError(`Failed to create order for ${item.displayName}. Check the fields and try again.`);
        return;
      }
      const order = (await res.json()) as { id: string; orderNumber: string };
      results.push({ id: order.id, orderNumber: order.orderNumber, displayName: item.displayName });
    }

    clear();
    setCreated(results);
    setSubmitting(false);
  }

  if (created) {
    return (
      <main className="page">
        <div className="checkout-success panel">
          <div className="panel-pad">
            <p className="eyebrow">Order received</p>
            <h1 className="page-title">You&apos;re all set</h1>
            <p className="lede">
              {created.length} {created.length === 1 ? "order" : "orders"} created. Each SKU runs as its own
              production order — MOA quality-checks the artwork before production.
            </p>
            <div className="tier-list" style={{ marginTop: 16 }}>
              {created.map((order) => (
                <Link key={order.id} href={`/orders/${order.id}`} className="tier-row">
                  <span>{order.displayName}</span>
                  <strong>{order.orderNumber} →</strong>
                </Link>
              ))}
            </div>
            <div className="action-row">
              <Link href="/" className="button">Back to catalog</Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (hydrated && items.length === 0) {
    return (
      <main className="page">
        <div className="empty-state">
          Your cart is empty. <Link href="/" className="link-button">Browse the catalog →</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Catalog</Link>
        <span aria-hidden>/</span>
        <Link href="/cart">Cart</Link>
        <span aria-hidden>/</span>
        <span className="crumb-current">Checkout</span>
      </nav>

      <div className="config-shell">
        <form action={submit} className="config-form" id="checkout-form">
          <div className="config-head">
            <p className="eyebrow">Checkout</p>
            <h1 className="page-title">Contact + ship-to</h1>
            <p className="lede">Entered once and applied to every SKU in your cart.</p>
          </div>

          <section className="step-block">
            <div className="form-grid">
              <label className="field"><span className="label">Contact name</span><input name="contactName" required /></label>
              <label className="field"><span className="label">Email</span><input name="contactEmail" type="email" required /></label>
              <label className="field"><span className="label">Phone</span><input name="contactPhone" required /></label>
              <label className="field"><span className="label">Company</span><input name="companyName" required /></label>
              <label className="field"><span className="label">Ship-to name</span><input name="shipToName" required /></label>
              <label className="field"><span className="label">Address line 1</span><input name="line1" required /></label>
              <label className="field"><span className="label">Address line 2</span><input name="line2" /></label>
              <label className="field"><span className="label">City</span><input name="city" required /></label>
              <label className="field"><span className="label">State</span><input name="state" required /></label>
              <label className="field"><span className="label">Postal code</span><input name="postalCode" required /></label>
              <label className="field"><span className="label">Country</span><input name="country" defaultValue="United States" required /></label>
            </div>
            {error ? <p className="form-error">{error}</p> : null}
          </section>
        </form>

        <aside className="price-box panel">
          <div className="price-box-pad">
            <p className="eyebrow">Order summary</p>
            <div className="price-stack">
              {items.map((item) => (
                <div className="price-line" key={item.lineId}>
                  <span>{item.displayName} · {item.quantity.toLocaleString()}</span>
                  <strong>{currency(item.totalUsd)}</strong>
                </div>
              ))}
            </div>
            <div className="price-total-big">
              <span className="price-total-num">{currency(total)}</span>
              <span className="price-total-sub">{items.length} orders · {count.toLocaleString()} units</span>
            </div>
            <button className="button button--lg button--full" type="submit" form="checkout-form" disabled={submitting}>
              {submitting ? "Creating orders…" : `Pay ${currency(total)}`}
            </button>
            <p className="trust-note">Simulated Stripe checkout. Creates one order per SKU.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
