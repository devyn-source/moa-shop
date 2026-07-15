import Link from "next/link";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { getProducts } from "@/lib/store";
import { listModelThumbs } from "@/lib/pattern-files";
import { ProductCard } from "@/components/ProductCard";
import { ProductShot } from "@/components/ProductShot";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import { FaqItem } from "@/components/FaqItem";
import { CaseStudies } from "@/components/CaseStudies";
import { currency, formatLeadTime } from "@/lib/pricing";
import { ALL_FAQS } from "@/lib/faqs";
import type { CatalogProduct } from "@/lib/types";

export const metadata: Metadata = {
  title: "Custom Merch, Made to Order — No Quotes | MOA Catalog",
  description:
    "Production-grade custom merch for modern brands. Pick a premium blank, upload your art, approve an instant proof — MOA manufactures and ships it. No quotes, no sales calls, no minimums runaround.",
};

const fromPrice = (p: CatalogProduct) => Math.min(...p.priceTiers.map((t) => t.perUnitUsd));
const heroVariant = (p: CatalogProduct) =>
  p.variants.find((v) => v.colorLabel === "Black" && v.recolor !== false) ??
  p.variants.find((v) => v.frontImage) ??
  p.variants[0];

// Stagger helper: sets a per-item index used by the reveal transition-delay.
const stagger = (i: number) => ({ "--lp-i": i } as CSSProperties);

/* --- Inline line icons (1.6 stroke, currentColor) --- */
const I = {
  badge: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="9" r="6" /><path d="M9 14.5 8 22l4-2.4L16 22l-1-7.5" />
    </svg>
  ),
  tag: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3.5 12.5 12 4h7v7l-8.5 8.5a2 2 0 0 1-2.8 0L3.5 15.3a2 2 0 0 1 0-2.8Z" /><circle cx="15.5" cy="8.5" r="1.2" />
    </svg>
  ),
  needle: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 20 20 4" /><path d="M14 4h6v6" /><circle cx="7" cy="17" r="2.4" />
    </svg>
  ),
  truck: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 6h11v9H2zM13 9h4l3 3v3h-7z" /><circle cx="6" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" />
    </svg>
  ),
  shirt: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 3 4 6 6 9l2-1v12h8V8l2 1 2-3-4-3-2 2a3 3 0 0 1-4 0Z" />
    </svg>
  ),
  upload: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 16V5M8 9l4-4 4 4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.4 2.4L16 9.5" />
    </svg>
  ),
  box: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
    </svg>
  ),
};

export default async function LandingPage() {
  const products = await getProducts();
  const modelThumbs = await listModelThumbs();
  const shoppable = products.filter(
    (p) => !p.isBundleBuilder && p.category !== "packaging" && p.slug !== "test-sku"
  );
  const hero = shoppable.find((p) => p.slug === "heavyweight-hoodie") ?? shoppable[0];
  const featured = shoppable.slice(0, 8);
  const fromLow = Math.min(...shoppable.map(fromPrice));
  const faqs = ALL_FAQS.slice(0, 6);

  const cred = [
    { icon: I.badge, t: "Production-grade", d: "The same garments we make for top brands" },
    { icon: I.tag, t: "No minimums runaround", d: "One clear price ladder, MOQ 50" },
    { icon: I.needle, t: "Decoration-ready", d: "Screen print, embroidery, woven labels" },
    { icon: I.truck, t: "Tracked to your door", d: "Live status from proof to delivery" },
  ];
  const steps = [
    { icon: I.shirt, t: "Pick a premium blank", d: "Choose from a curated range of production-grade styles — each one decoration-ready." },
    { icon: I.upload, t: "Upload your artwork", d: "Drop in your art, place it on the garment, and pick colors. See exactly how it prints." },
    { icon: I.check, t: "Approve your proof", d: "We generate an instant digital proof. Tweak it yourself until it's right, then approve." },
    { icon: I.box, t: "We make & ship it", d: "MOA manufactures to spec with managed QC and ships it, with tracking emailed on dispatch." },
  ];
  // Real clients (logos pulled from magnumopus.agency). Per-logo height is tuned
  // by aspect ratio so wide wordmarks and compact marks feel the same visual size.
  const clients: [string, string, number][] = [
    ["nike", "Nike", 26], ["burberry", "Burberry", 20], ["ralph-lauren", "Ralph Lauren", 19],
    ["activision", "Activision", 23], ["live-nation", "Live Nation", 22], ["bacardi", "Bacardi", 22],
    ["google", "Google", 24], ["canva", "Canva", 25], ["goldenvoice", "Goldenvoice", 22], ["kaytranada", "Kaytranada", 17],
    ["evisu", "Evisu", 22], ["pudgy-penguins", "Pudgy Penguins", 34], ["cherry", "Cherry", 32],
    ["bigface", "Bigface", 21], ["groq", "Groq", 27], ["twojeys", "Two Jeys", 20],
    ["tepn", "TEPN", 22], ["paly", "Paly", 32],
  ];

  return (
    <main className="lp">
      <ScrollReveal />

      {/* ===== Hero ===== */}
      <section className="lp-hero">
        <div className="lp-hero-copy" data-reveal>
          <p className="lp-eyebrow">The MOA Catalog</p>
          <h1 className="lp-h1">
            Premium custom merch,
            <br />
            <span className="lp-h1-accent">made to order.</span>
          </h1>
          <p className="lp-sub">
            Pick a production-grade blank, upload your artwork, and approve an instant
            proof. MOA manufactures it to spec and ships it to your door — no quotes,
            no sales calls, no minimums runaround.
          </p>
          <div className="lp-cta-row">
            <Link className="lp-btn lp-btn--primary" href="#shop">Build your merch →</Link>
            <Link className="lp-btn lp-btn--ghost" href="/shop">Browse the catalog</Link>
          </div>
          <ul className="lp-hero-trust">
            <li>Transparent per-unit pricing</li>
            <li>Instant self-serve proof</li>
            <li>MOA-managed quality control</li>
          </ul>
        </div>

        <div className="lp-hero-stage" data-reveal style={stagger(1)}>
          {hero ? (
            <div className="lp-hero-shot">
              {/* The landing LCP — eager, high-priority load. */}
              <ProductShot product={hero} variant={heroVariant(hero)} view="front" priority sizes="(max-width: 900px) 88vw, 40vw" />
              {/* a real logo printed on the chest — what a finished proof looks like */}
              <span className="lp-hero-logo" aria-hidden />
            </div>
          ) : null}
          <span className="lp-hero-caption">
            {hero?.displayName} · from {currency(fromLow)}/unit
          </span>
        </div>
      </section>

      {/* ===== Trusted-by marquee (real clients) ===== */}
      <section className="lp-marquee" aria-label="Brands MOA has produced merch for">
        <p className="lp-marquee-label">The studio behind merch for</p>
        <div className="lp-marquee-viewport">
          <div className="lp-marquee-track">
            {[...clients, ...clients].map(([slug, name, h], i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${slug}-${i}`}
                className="lp-marquee-logo"
                src={`/brand/clients/${slug}.png`}
                alt={name}
                loading="lazy"
                aria-hidden={i >= clients.length}
                style={{ ["--logo-h"]: `${h}px` } as CSSProperties}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ===== Credibility strip ===== */}
      <section className="lp-cred" data-reveal>
        {cred.map((c, i) => (
          <div key={c.t} className="lp-cred-item" style={stagger(i)}>
            <span className="lp-cred-icon">{c.icon}</span>
            <strong>{c.t}</strong>
            <span className="lp-cred-d">{c.d}</span>
          </div>
        ))}
      </section>

      {/* ===== How it works ===== */}
      <section className="lp-section" id="how">
        <div className="lp-section-head" data-reveal>
          <span className="lp-index">01 — Process</span>
          <h2 className="lp-h2">From idea to doorstep in four steps</h2>
          <p className="lp-section-lede">
            The whole process is self-serve. No RFQs, no back-and-forth, no waiting on a
            sales rep to email you a quote.
          </p>
        </div>
        <div className="lp-steps">
          {steps.map((s, i) => (
            <div key={s.t} className="lp-step" data-reveal style={stagger(i)}>
              <span className="lp-step-top">
                <span className="lp-step-icon">{s.icon}</span>
                <span className="lp-step-n">{String(i + 1).padStart(2, "0")}</span>
              </span>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Featured products ===== */}
      <section className="lp-section lp-shop" id="shop">
        <div className="lp-section-head" data-reveal>
          <span className="lp-index">02 — The range</span>
          <h2 className="lp-h2">Start with a best-seller</h2>
          <p className="lp-section-lede">
            Every style is a garment we already produce for leading brands — curated, not an
            endless generic catalog.
          </p>
        </div>
        <div className="lp-grid">
          {featured.map((p, i) => (
            <div key={p.id} data-reveal style={stagger(i % 4)}>
              <ProductCard product={p} modelThumbUrl={modelThumbs[p.slug]} />
            </div>
          ))}
        </div>
        <div className="lp-shop-cta" data-reveal>
          <Link className="lp-btn lp-btn--primary" href="/shop">See the full catalog →</Link>
        </div>
      </section>

      {/* ===== Instant proof spotlight (dark, editorial) ===== */}
      <section className="lp-proof">
        <div className="lp-proof-copy" data-reveal>
          <span className="lp-index lp-index--light">03 — The advantage</span>
          <h2 className="lp-h2">See it before you buy it.</h2>
          <p className="lp-section-lede">
            Upload your art and watch it land on the garment — adjust placement, size, color
            and decoration method yourself. The proof you approve is the spec we produce.
            No mockup fees, no waiting days for a sales rep to send a PDF.
          </p>
          <ul className="lp-proof-list">
            <li>Drag, scale and rotate your art on a live garment</li>
            <li>Print-resolution check before you ever pay</li>
            <li>Add a woven brand label, sewn in</li>
            <li>Share a link for sign-off before you order</li>
          </ul>
          <Link className="lp-btn lp-btn--primary" href="#shop">Try it on a product →</Link>
        </div>
        <div className="lp-proof-stage" data-reveal style={stagger(1)}>
          <div className="lp-proof-shot">
            {hero ? <ProductShot product={hero} variant={heroVariant(hero)} view="front" /> : null}
            {/* a real logo printed on the chest — what an approved proof looks like */}
            <span className="lp-proof-logo" aria-hidden />
          </div>
          <span className="lp-proof-tag">Live preview</span>
        </div>
      </section>

      {/* ===== Comparison ===== */}
      <section className="lp-section">
        <div className="lp-section-head" data-reveal>
          <span className="lp-index">04 — Why teams switch</span>
          <h2 className="lp-h2">The old way vs the MOA way</h2>
        </div>
        <div className="lp-compare">
          <div className="lp-compare-col lp-compare-col--old" data-reveal>
            <p className="lp-compare-title">Traditional merch vendors</p>
            <ul>
              <li>Email an RFQ, wait days for a quote</li>
              <li>Pay mockup fees, wait for PDF proofs</li>
              <li>Opaque pricing, surprise add-ons</li>
              <li>Generic blank catalogs</li>
              <li>No visibility once you order</li>
            </ul>
          </div>
          <div className="lp-compare-col lp-compare-col--moa" data-reveal style={stagger(1)}>
            <p className="lp-compare-title">MOA Catalog</p>
            <ul>
              <li>Self-serve, transparent per-unit pricing</li>
              <li>Free instant proof you control</li>
              <li>What you see is what you pay</li>
              <li>Production-grade, decoration-ready styles</li>
              <li>Live tracking from proof to delivery</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ===== Guarantee (charcoal band) ===== */}
      <section className="lp-guarantee">
        <div data-reveal>
          <span className="lp-index lp-index--light">05 — Zero-risk by design</span>
          <h2 className="lp-h2">Nothing is made until you approve it.</h2>
          <p className="lp-section-lede">
            Your approved proof <em>is</em> the quality bar. Every order runs through
            MOA-managed quality control before it ships — the same standard behind the
            studio top brands trust for their best merch.
          </p>
        </div>
      </section>

      {/* ===== Selected work (full diverse grid) ===== */}
      <section className="lp-section lp-work" data-reveal>
        <CaseStudies />
      </section>

      {/* ===== FAQ ===== */}
      <section className="lp-section lp-faq" id="faq">
        <div className="lp-section-head" data-reveal>
          <span className="lp-index">06 — Good to know</span>
          <h2 className="lp-h2">Questions, answered</h2>
        </div>
        <div className="lp-faq-list">
          {faqs.map((f, i) => (
            <FaqItem key={f.q} q={f.q} a={f.a} style={stagger(i)} />
          ))}
        </div>
        <div className="lp-faq-more" data-reveal>
          <Link className="lp-link" href="/faq">Read all FAQs →</Link>
        </div>
      </section>

      {/* ===== Final CTA ===== */}
      <section className="lp-final">
        <div data-reveal>
          <h2 className="lp-final-h">Make the merch your brand deserves.</h2>
          <p className="lp-final-sub">
            Pick a blank, upload your art, approve your proof. From {currency(fromLow)}/unit,
            delivered in {hero ? formatLeadTime(hero.leadTimeDays) : "weeks"}.
          </p>
          <div className="lp-cta-row lp-cta-row--center">
            <Link className="lp-btn lp-btn--primary lp-btn--lg" href="#shop">Build your merch →</Link>
            <Link className="lp-btn lp-btn--ghost lp-btn--lg" href="/shop">Browse the catalog</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
