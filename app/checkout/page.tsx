"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/CartProvider";
import { analytics } from "@/lib/analytics";
import { currency } from "@/lib/pricing";
import { BrandSelect } from "@/components/BrandSelect";
import { useUser } from "@clerk/nextjs";

const US_STATES = [
  { value: "", label: "Select state" },
  ...[
    ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"],
    ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"],
    ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"],
    ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"],
    ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
    ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"],
    ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"],
    ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"],
    ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"],
    ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"],
    ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
    ["PR", "Puerto Rico"],
  ].map(([value, label]) => ({ value, label })),
];

const COUNTRIES = [
  "United States", "Canada", "United Kingdom", "Australia", "New Zealand", "Ireland", "Germany",
  "France", "Netherlands", "Belgium", "Spain", "Italy", "Sweden", "Denmark", "Switzerland", "Mexico",
  "Brazil", "Japan", "South Korea", "Singapore", "Hong Kong", "United Arab Emirates", "India", "Other",
].map((c) => ({ value: c, label: c }));

type Form = {
  contactName: string; contactEmail: string; contactPhone: string; companyName: string;
  shipToName: string; line1: string; line2: string; city: string; state: string; postalCode: string; country: string;
};

export default function CheckoutPage() {
  const { items, total, count, hydrated } = useCart();
  useEffect(() => {
    if (hydrated && items.length) analytics.beginCheckout({ count, value: total });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [f, setF] = useState<Form>({
    contactName: "", contactEmail: "", contactPhone: "", companyName: "",
    shipToName: "", line1: "", line2: "", city: "", state: "", postalCode: "", country: "United States",
  });
  const on = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const setVal = (k: keyof Form, v: string) => setF((p) => ({ ...p, [k]: v }));

  const [ipAttested, setIpAttested] = useState(false);

  // Pre-fill contact from the signed-in Clerk account (sign-in is required to
  // reach checkout). Fields stay editable — the order contact may differ.
  const { user } = useUser();
  const accountEmail = user?.primaryEmailAddress?.emailAddress ?? null;
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || !user) return;
    prefilled.current = true;
    setF((p) => ({
      ...p,
      contactEmail: accountEmail || p.contactEmail,
      contactName: user.fullName || p.contactName,
    }));
  }, [user, accountEmail]);

  const isUS = f.country === "United States";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ipAttested) {
      setError("Please confirm you own or have the rights to use this artwork.");
      return;
    }
    setSubmitting(true);
    setError("");
    analytics.checkoutSubmitted({ count, value: total });

    const contact = {
      contactName: f.contactName, contactEmail: f.contactEmail, contactPhone: f.contactPhone, companyName: f.companyName,
      shipToName: f.shipToName,
      shipToAddress: { line1: f.line1, line2: f.line2, city: f.city, state: f.state, postalCode: f.postalCode, country: f.country },
    };

    const payloadItems = items.map((item) => {
      const sizeSummary = Object.entries(item.sizeQty).map(([s, q]) => `${s}:${q}`).join(" ");
      return {
        productId: item.productId, variantId: item.variantId, decorationIds: item.decorationIds,
        quantity: item.quantity, displayName: item.displayName, colorLabel: item.colorLabel,
        decorationLabel: item.decorationLabel, artworkFileName: item.artworkFileName, artworkFileUrl: item.artworkFileUrl,
        artworkPlacement: item.artworkPlacement, artworkPlacements: item.artworkPlacements, wovenLabel: item.wovenLabel, sizeBreakdown: item.sizeQty,
        artworkNotes: sizeSummary ? `Sizes — ${sizeSummary}${item.artworkNotes ? `\n\n${item.artworkNotes}` : ""}` : item.artworkNotes,
      };
    });

    const res = await fetch("/api/checkout", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: payloadItems, contact, ipAttested }),
    });
    const data = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !data.url) {
      setSubmitting(false);
      setError(data.error || "Checkout could not start. Check the fields and try again.");
      return;
    }
    window.location.href = data.url;
  }

  if (hydrated && items.length === 0) {
    return (
      <main className="page">
        <div className="empty-state">Your cart is empty. <Link href="/" className="link-button">Browse the catalog →</Link></div>
      </main>
    );
  }

  return (
    <main className="page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Catalog</Link><span aria-hidden>/</span>
        <Link href="/cart">Cart</Link><span aria-hidden>/</span>
        <span className="crumb-current">Checkout</span>
      </nav>

      <div className="config-shell">
        <form onSubmit={submit} className="config-form" id="checkout-form">
          <div className="config-head">
            <p className="eyebrow">Checkout</p>
            <h1 className="page-title">Contact &amp; shipping</h1>
            <p className="lede">Entered once and applied to every SKU in your order.</p>
          </div>

          {accountEmail && (
            <div className="co-account">
              <div>
                <p className="co-account-label">Signed in</p>
                <p className="co-account-email">{accountEmail}</p>
              </div>
            </div>
          )}

          <section className="co-section">
            <p className="co-section-title">Contact</p>
            <div className="co-grid">
              <label className="co-field">
                <span className="label">Contact name</span>
                <input className="co-input" value={f.contactName} onChange={on("contactName")} required autoComplete="name" />
              </label>
              <label className="co-field">
                <span className="label">Email</span>
                <input className="co-input" type="email" value={f.contactEmail} onChange={on("contactEmail")} required autoComplete="email" />
              </label>
              <label className="co-field">
                <span className="label">Phone</span>
                <input className="co-input" value={f.contactPhone} onChange={on("contactPhone")} autoComplete="tel" inputMode="tel" />
              </label>
              <label className="co-field">
                <span className="label">Company</span>
                <input className="co-input" value={f.companyName} onChange={on("companyName")} autoComplete="organization" />
              </label>
            </div>
          </section>

          <section className="co-section">
            <p className="co-section-title">Ship to</p>
            <div className="co-grid">
              <label className="co-field co-field--full">
                <span className="label">Recipient / attention</span>
                <input className="co-input" value={f.shipToName} onChange={on("shipToName")} autoComplete="name" placeholder="Name on the shipment" />
              </label>
              <label className="co-field co-field--full">
                <span className="label">Address line 1</span>
                <input className="co-input" value={f.line1} onChange={on("line1")} required autoComplete="address-line1" />
              </label>
              <label className="co-field co-field--full">
                <span className="label">Address line 2</span>
                <input className="co-input" value={f.line2} onChange={on("line2")} autoComplete="address-line2" placeholder="Suite, floor, unit (optional)" />
              </label>
              <label className="co-field">
                <span className="label">City</span>
                <input className="co-input" value={f.city} onChange={on("city")} required autoComplete="address-level2" />
              </label>
              <div className="co-field">
                <span className="label">{isUS ? "State" : "State / Province"}</span>
                {isUS ? (
                  <div className="co-select">
                    <BrandSelect value={f.state} options={US_STATES} ariaLabel="State" onChange={(v) => setVal("state", v)} />
                  </div>
                ) : (
                  <input className="co-input" value={f.state} onChange={on("state")} placeholder="State / Province / Region" />
                )}
              </div>
              <label className="co-field">
                <span className="label">Postal code</span>
                <input className="co-input" value={f.postalCode} onChange={on("postalCode")} required autoComplete="postal-code" />
              </label>
              <div className="co-field">
                <span className="label">Country</span>
                <div className="co-select">
                  <BrandSelect value={f.country} options={COUNTRIES} ariaLabel="Country" onChange={(v) => setVal("country", v)} />
                </div>
              </div>
            </div>
            {error ? <p className="form-error" style={{ marginTop: 16 }}>{error}</p> : null}
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
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", margin: "4px 0 14px", cursor: "pointer" }}>
              <input type="checkbox" checked={ipAttested} onChange={(e) => setIpAttested(e.target.checked)} style={{ marginTop: 3, accentColor: "var(--color-terracotta)", width: 16, height: 16 }} />
              <span style={{ fontSize: "0.72rem", lineHeight: 1.5, color: "var(--color-neutral)" }}>
                I own or have the rights to use this artwork, and agree to the <a href="/terms" target="_blank" rel="noreferrer" style={{ color: "var(--color-terracotta)" }}>Terms</a> &amp; <a href="/refund-policy" target="_blank" rel="noreferrer" style={{ color: "var(--color-terracotta)" }}>Refund Policy</a>.
              </span>
            </label>
            <button className="button button--lg button--full" type="submit" form="checkout-form" disabled={submitting || !ipAttested}>
              {submitting ? "Redirecting to checkout…" : `Pay ${currency(total)} · secure checkout`}
            </button>
            <p className="trust-note">Secure payment via Stripe. One order is created per SKU.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
