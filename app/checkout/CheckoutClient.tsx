"use client";

import { BespokeLine } from "@/components/hx/Bespoke";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/CartProvider";
import { analytics } from "@/lib/analytics";
import { currency } from "@/lib/pricing";
import { InvoiceRequestDialog } from "@/components/InvoiceRequestDialog";
import { useUser } from "@clerk/nextjs";

// Clerk is mounted only when configured (app/layout.tsx MaybeClerk). On envs
// without a Clerk key (e.g. preview deployments) there's no <ClerkProvider>, so
// useUser() would throw during prerender. Isolate it in this child that only
// mounts when Clerk is present; it reports the signed-in identity up for prefill.
const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

function ClerkContactPrefill({ onPrefill }: { onPrefill: (name: string | null, email: string | null) => void }) {
  const { user } = useUser();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !user) return;
    done.current = true;
    onPrefill(user.fullName, user.primaryEmailAddress?.emailAddress ?? null);
  }, [user, onPrefill]);
  return null;
}

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

type ContactForm = {
  contactName: string; contactEmail: string; contactPhone: string; companyName: string;
  shipToName: string; line1: string; line2: string; city: string; state: string; postalCode: string; country: string;
};

export function CheckoutClient({ express = false }: { express?: boolean }) {
  const { items, total, count, hydrated } = useCart();
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [country, setCountry] = useState("United States");
  const [ipAttested, setIpAttested] = useState(false);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const isUS = country === "United States";

  useEffect(() => {
    if (hydrated && items.length) analytics.beginCheckout({ count, value: total });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // Native inputs retain browser autofill. Late account loading must never
  // overwrite something the customer or their browser has already entered.
  const handlePrefill = useCallback((name: string | null, email: string | null) => {
    setAccountEmail(email);
    for (const [key, value] of [["contactName", name], ["contactEmail", email]]) {
      const field = formRef.current?.elements.namedItem(key || "");
      if (field instanceof HTMLInputElement && value && (key === "contactEmail" || !field.value)) field.value = value;
    }
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submittingRef.current) return;
    if (!ipAttested) {
      setError("Please confirm you have the rights to use this artwork.");
      return;
    }
    // Read the DOM at submission, including autofill values that may not have
    // dispatched a React change event. Do not persist personal data locally.
    const fields = new FormData(e.currentTarget);
    const value = (key: keyof ContactForm) => String(fields.get(key) ?? "").trim();
    const contact = {
      contactName: value("contactName"), contactEmail: value("contactEmail").toLowerCase(),
      contactPhone: value("contactPhone"), companyName: value("companyName"),
      shipToName: value("shipToName") || value("contactName"),
      shipToAddress: {
        line1: value("line1"), line2: value("line2"), city: value("city"), state: value("state"),
        postalCode: value("postalCode"), country: country === "Other" ? String(fields.get("otherCountry") ?? "").trim() : value("country"),
      },
    };
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    analytics.checkoutSubmitted({ count, value: total });
    const payloadItems = items.map((item) => {
      const sizeSummary = Object.entries(item.sizeQty).map(([s, q]) => `${s}:${q}`).join(" ");
      return {
        productId: item.productId, variantId: item.variantId, decorationIds: item.decorationIds,
        quantity: item.quantity, displayName: item.displayName, colorLabel: item.colorLabel,
        decorationLabel: item.decorationLabel, artworkFileName: item.artworkFileName, artworkFileUrl: item.artworkFileUrl,
        mockupUrls: item.mockupUrls, artworkPlacement: item.artworkPlacement, artworkPlacements: item.artworkPlacements,
        wovenLabel: item.wovenLabel, fabricOptionId: item.fabricOptionId, sizeBreakdown: item.sizeQty,
        artworkNotes: sizeSummary ? `Sizes: ${sizeSummary}${item.artworkNotes ? `\n\n${item.artworkNotes}` : ""}` : item.artworkNotes,
        bundleId: item.bundleId, bundleLabel: item.bundleLabel, bundleRole: item.bundleRole, perBoxQty: item.perBoxQty, printed: item.printed,
      };
    });
    try {
      const res = await fetch("/api/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payloadItems, contact, ipAttested }),
      });
      const data = await res.json().catch(() => ({})) as { url?: string; error?: string };
      if (res.status === 401) throw new Error("Your session has expired. Sign in again to continue; your cart is saved.");
      if (!res.ok || !data.url) throw new Error(data.error || "Payment could not start. Check your details and try again.");
      window.location.assign(data.url);
    } catch (err) {
      setError(err instanceof TypeError ? "We could not connect. Your details are still here. Please try again." : err instanceof Error ? err.message : "Checkout could not start. Please try again.");
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (!hydrated) return <main className="page checkout-page" aria-busy="true"><p>Loading your order…</p></main>;
  if (!items.length) return <main className="page checkout-page"><div className="empty-state">Your cart is empty. <Link href="/shop" className="link-button">Browse the shop</Link></div></main>;

  return (
    <main className="page checkout-page">
      {clerkConfigured ? <ClerkContactPrefill onPrefill={handlePrefill} /> : null}
      <nav className="co-progress" aria-label="Checkout progress">
        <Link href="/cart"><span>01</span> Cart</Link>
        <span aria-current="step"><span>02</span> Details</span>
        <span><span>03</span> Payment</span>
      </nav>
      <header className="co-heading">
        <p className="eyebrow">Checkout</p>
        <h1 className="hx-h2">The final details.</h1>
        <p className="hx-body">One delivery address for your order. Your production proof follows payment.</p>
      </header>
      <div className="co-layout">
        <form onSubmit={submit} ref={formRef} className="co-form" id="checkout-form" autoComplete="on" aria-busy={submitting}>
          {accountEmail ? <div className="co-identity"><span>Signed in as</span> {accountEmail}</div> : null}
          <section className="co-card" aria-labelledby="contact-heading">
            <div className="co-card-head"><span className="co-section-number">01</span><div><h2 id="contact-heading">Contact</h2><p>Order updates and your proof go to your account email.</p></div></div>
            <div className="co-grid">
              <label className="co-field" htmlFor="contact-name"><span className="label">Full name</span><input className="co-input" id="contact-name" name="contactName" required autoComplete="section-contact name" maxLength={120} /></label>
              <label className="co-field" htmlFor="contact-email"><span className="label">Email address</span><input className="co-input" id="contact-email" name="contactEmail" type="email" readOnly={!!accountEmail} required autoComplete="section-contact email" autoCapitalize="none" spellCheck={false} maxLength={200} /></label>
              <label className="co-field" htmlFor="contact-phone"><span className="label">Phone <small>Optional</small></span><input className="co-input" id="contact-phone" name="contactPhone" type="tel" autoComplete="section-contact tel" maxLength={40} /></label>
              <label className="co-field" htmlFor="contact-company"><span className="label">Company <small>Optional</small></span><input className="co-input" id="contact-company" name="companyName" autoComplete="section-contact organization" maxLength={160} /></label>
            </div>
          </section>
          <section className="co-card" aria-labelledby="shipping-heading">
            <div className="co-card-head"><span className="co-section-number">02</span><div><h2 id="shipping-heading">Shipping address</h2><p>Where should we send your finished pieces?</p></div></div>
            <div className="co-grid">
              <label className="co-field co-field--full" htmlFor="shipping-country"><span className="label">Country / region</span><select className="co-input co-native-select" id="shipping-country" name="country" autoComplete="section-shipping shipping country-name" defaultValue="United States" onChange={(e) => setCountry(e.target.value)} required>{(express ? COUNTRIES.slice(0, 1) : COUNTRIES).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
              {country === "Other" ? <label className="co-field co-field--full" htmlFor="shipping-other-country"><span className="label">Country name</span><input className="co-input" id="shipping-other-country" name="otherCountry" required autoComplete="section-shipping shipping country-name" maxLength={80} /></label> : null}
              <label className="co-field co-field--full" htmlFor="shipping-recipient"><span className="label">Recipient <small>Optional</small></span><input className="co-input" id="shipping-recipient" name="shipToName" autoComplete="section-shipping shipping name" maxLength={160} placeholder="Same as contact name" /></label>
              <label className="co-field co-field--full" htmlFor="shipping-address"><span className="label">Street address</span><input className="co-input" id="shipping-address" name="line1" required autoComplete="section-shipping shipping address-line1" maxLength={200} /></label>
              <label className="co-field co-field--full" htmlFor="shipping-address2"><span className="label">Apartment, suite, etc. <small>Optional</small></span><input className="co-input" id="shipping-address2" name="line2" autoComplete="section-shipping shipping address-line2" maxLength={200} /></label>
              <label className="co-field co-field--full" htmlFor="shipping-city"><span className="label">City</span><input className="co-input" id="shipping-city" name="city" required autoComplete="section-shipping shipping address-level2" maxLength={120} /></label>
              <label className="co-field" htmlFor="shipping-state"><span className="label">{isUS ? "State" : "State / province"}</span>{isUS ? <select className="co-input co-native-select" id="shipping-state" name="state" required autoComplete="section-shipping shipping address-level1" defaultValue="">{US_STATES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select> : <input className="co-input" id="shipping-state" name="state" autoComplete="section-shipping shipping address-level1" maxLength={80} />}</label>
              <label className="co-field" htmlFor="shipping-postal"><span className="label">{isUS ? "ZIP code" : "Postal code"}</span><input className="co-input" id="shipping-postal" name="postalCode" required autoComplete="section-shipping shipping postal-code" inputMode={isUS ? "numeric" : "text"} maxLength={20} /></label>
            </div>
          </section>
        </form>
        <aside className="co-summary" aria-labelledby="summary-heading">
          <div className="co-summary-head"><h2 id="summary-heading">Your order</h2><Link href="/cart">Edit cart</Link></div>
          <div className="co-items">{items.map((item) => (
            <article className="co-item" key={item.lineId}>
              {item.mockupUrls?.front || item.mockupUrls?.back || item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.mockupUrls?.front || item.mockupUrls?.back || item.image} alt={`${item.displayName} in ${item.colorLabel}`} className="co-item-image" />
              ) : <div className="co-item-image" aria-hidden="true" />}
              <div><h3>{item.displayName}</h3><p>{item.colorLabel} · {item.quantity.toLocaleString()} units</p><p>{item.decorationLabel}</p><strong>{currency(item.totalUsd)}</strong></div>
            </article>
          ))}</div>
          <div className="co-total"><div><span>Subtotal</span><small>{count.toLocaleString()} units · {items.length} {items.length === 1 ? "style" : "styles"}</small></div><strong>{currency(total)}</strong></div>
          <label className="co-consent"><input type="checkbox" name="ipAttested" form="checkout-form" checked={ipAttested} onChange={(e) => setIpAttested(e.target.checked)} required /><span>I have the rights to use this artwork and agree to the <Link href="/terms" target="_blank">Terms</Link> and <Link href="/refund-policy" target="_blank">Refund Policy</Link>.</span></label>
          {error ? <p className="co-error" role="alert">{error}</p> : null}
          <button className="button button--lg button--full co-pay" type="submit" form="checkout-form" disabled={submitting || !ipAttested}>{submitting ? "Opening payment…" : "Continue to payment"}<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></button>
          <p className="co-payment-note">Applicable sales tax is calculated at payment. Pay for your order, then review your production proof. Nothing is made until you approve.</p>
          <div className="co-next"><span>After payment</span><h3>Your proof, then production.</h3><p>{express ? "We check every placement and prepare your proof by the end of the next business day. Review it or request a change from your account." : "We check your artwork and prepare your production proof for approval in your account."}</p></div>
          <div className="co-help"><InvoiceRequestDialog prefillEmail={accountEmail ?? ""} /><BespokeLine from="checkout" className="trust-note" /></div>
        </aside>
      </div>
    </main>
  );
}
