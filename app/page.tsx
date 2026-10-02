import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { getProducts } from "@/lib/store";
import { listModelThumbs } from "@/lib/pattern-files";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import { StickyCta } from "@/components/landing/StickyCta";
import { FaqItem } from "@/components/FaqItem";
import { StyleTiles } from "@/components/hx/StyleTiles";
import { HowRows } from "@/components/hx/HowRows";
import { currency, formatLeadTime } from "@/lib/pricing";
import { ALL_FAQS } from "@/lib/faqs";
import type { CatalogProduct } from "@/lib/types";

export const metadata: Metadata = {
  title: "Custom Cut and Sew Merch for Smaller Orders | MOA Shop",
  description:
    "Custom cut and sew in smaller runs. Every style is made to our own patterns. Design it on the garment, a proof within 24 business hours and one invoice.",
};

const fromPrice = (p: CatalogProduct) => Math.min(...p.priceTiers.map((t) => t.perUnitUsd));
const stagger = (i: number) => ({ "--lp-i": i } as CSSProperties);

// Same layout language as the studio site: full-bleed photography, the terracotta
// wordmark, big left-aligned section titles, hairline rows. The shop path comes first.
export default async function LandingPage() {
  const [products, thumbs] = await Promise.all([getProducts(), listModelThumbs()]);
  const styles = products.filter((p) => !p.isBundleBuilder && p.category !== "packaging" && p.slug !== "test-sku");
  const fromLow = Math.min(...styles.map(fromPrice));
  const moq = Math.min(...styles.map((p) => p.moq));
  const lead = Math.min(...styles.map((p) => p.leadTimeDays));
  const faqs = ALL_FAQS.slice(0, 6);
  const clients: [string, string, number][] = [
    ["nike", "Nike", 26], ["burberry", "Burberry", 20], ["ralph-lauren", "Ralph Lauren", 19],
    ["activision", "Activision", 23], ["live-nation", "Live Nation", 22], ["bacardi", "Bacardi", 22],
    ["google", "Google", 24], ["canva", "Canva", 25], ["goldenvoice", "Goldenvoice", 22], ["kaytranada", "Kaytranada", 17],
    ["evisu", "Evisu", 22], ["pudgy-penguins", "Pudgy Penguins", 34], ["cherry", "Cherry", 32],
    ["bigface", "Bigface", 21], ["groq", "Groq", 27], ["twojeys", "Two Jeys", 20],
    ["tepn", "TEPN", 22], ["paly", "Paly", 32],
  ];

  const work = [
    { img: "/landing/work-a.webp", tag: "Entertainment", name: "Coachella" },
    { img: "/landing/work-b.webp", tag: "Enterprise", name: "Google I/O" },
    { img: "/landing/work-c.webp", tag: "Fashion", name: "Cherry Los Angeles" },
  ];

  return (
    <main className="hx">
      <ScrollReveal />
      <StickyCta fromLabel={`From ${currency(fromLow)}/unit`} />

      {/* ===== Hero: the studio's photo + wordmark, the shop's offer ===== */}
      <section className="hx-hero">
        <Image className="hx-hero-img" src="/landing/studio-hero.webp" alt="The Magnum Opus studio in Los Angeles" fill priority sizes="100vw" />
        <div className="hx-hero-shade" aria-hidden />
        <div className="hx-hero-inner">
          <ul className="hx-hero-tags">
            <li>Cut and sew</li>
            <li>{moq} piece minimum</li>
            <li>Proof in 24 hours</li>
            <li>One invoice</li>
          </ul>
          <h1 className="hx-wordmark">MOA Shop</h1>
          <div className="hx-hero-foot">
            <div>
              <p className="hx-hero-lede">Custom merch in smaller runs, cut and sewn to our own patterns.</p>
              <p className="hx-hero-sub">From {currency(fromLow)}/unit. Designed on the garment, proofed within 24 business hours.</p>
            </div>
            <div className="hx-hero-ctas">
              <Link className="hx-btn hx-btn--primary" href="#styles">Start designing</Link>
              <Link className="hx-btn hx-btn--glass" href="/shop">Browse styles</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Clientele ===== */}
      <section className="hx-row hx-clients" aria-label="Clientele">
        <h2 className="hx-h2">Clientele</h2>
        <div className="lp-marquee-viewport">
          <div className="lp-marquee-track">
            {[...clients, ...clients].map(([slug, name, h], i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={`${slug}-${i}`} className="lp-marquee-logo" src={`/brand/clients/${slug}.png`} alt={name} loading="lazy" aria-hidden={i >= clients.length} style={{ ["--logo-h"]: `${h}px` } as CSSProperties} />
            ))}
          </div>
        </div>
      </section>

      {/* ===== The styles (the conversion core, high on the page) ===== */}
      <section className="hx-row hx-styles" id="styles">
        <div className="hx-split-head" data-reveal>
          <h2 className="hx-h2">The styles</h2>
          <div className="hx-split-side">
            <p className="hx-body">{styles.length} styles, cut and sewn to the patterns we produce for our clients. From {currency(fromLow)}/unit, {moq} piece minimum, delivered in {formatLeadTime(lead)}.</p>
            <Link className="hx-btn hx-btn--dark" href="/shop">Browse all styles</Link>
          </div>
        </div>
        <StyleTiles products={styles} thumbs={thumbs} />
      </section>

      <HowRows stylesHref="#styles" />

      {/* ===== See it before it is made ===== */}
      <section className="hx-dark">
        <div className="hx-dark-copy" data-reveal>
          <h2 className="hx-h2 hx-h2--light">See it before it is made.</h2>
          <p className="hx-body hx-body--light">Your artwork goes onto a photo of the real garment, in the colour you pick, at its exact size and position in inches. Resolution and seams are checked as you place it.</p>
          <dl className="hx-facts hx-facts--light">
            <div><dt>Mockup fees</dt><dd>None</dd></div>
            <div><dt>Proof</dt><dd>24 hr</dd></div>
            <div><dt>Made before you approve</dt><dd>Nothing</dd></div>
          </dl>
          <Link className="hx-btn hx-btn--primary" href="#styles">Start designing</Link>
        </div>
        <figure className="hx-dark-shot" data-reveal style={stagger(1)}>
          <Image src="/landing/configurator-live.webp" alt="The MOA Shop configurator: a Jet Black heavyweight hoodie with the artwork placed at centre chest" width={1266} height={1570} sizes="(max-width: 900px) 92vw, 520px" />
          <figcaption>Captured from the configurator</figcaption>
        </figure>
      </section>

      {/* ===== Studio proof points ===== */}
      <section className="hx-row hx-studio">
        <h2 className="hx-h2" data-reveal>Studio</h2>
        <div className="hx-split-side" data-reveal style={stagger(1)}>
          <p className="hx-lead">The MOA Shop is run by Magnum Opus, a Los Angeles studio of designers, producers and engineers. Same team, same factories, same quality control as our largest programs.</p>
          <dl className="hx-facts">
            <div><dt>Brands</dt><dd>112</dd></div>
            <div><dt>Units delivered</dt><dd>504,731</dd></div>
            <div><dt>Projects completed</dt><dd>198</dd></div>
          </dl>
        </div>
      </section>

      {/* ===== Signature work ===== */}
      <section className="hx-row hx-work">
        <h2 className="hx-h2" data-reveal>Signature work</h2>
        <div className="hx-work-grid">
          {work.map((w, i) => (
            <figure key={w.name} className="hx-work-card" data-reveal style={stagger(i)}>
              <Image src={w.img} alt={w.name} fill sizes="(max-width: 700px) 92vw, 32vw" />
              <span className="hx-work-tag">{w.tag}</span>
              <figcaption>{w.name}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ===== Made, not printed ===== */}
      <section className="hx-row hx-compare">
        <h2 className="hx-h2" data-reveal>Made, not printed</h2>
        <div className="hx-table" data-reveal style={stagger(1)}>
          <div className="hx-table-head"><span /><span>Print shops</span><span>MOA Shop</span></div>
          {[
            ["Garment", "Stock blanks with a print", "Cut and sewn to our patterns"],
            ["Price", "A quote by email, days later", "Shown per unit, up front"],
            ["Mockups", "Fees and PDF back-and-forth", "Live on the garment, free"],
            ["Billing", "Add-ons after the fact", "One invoice for the full order"],
            ["After you order", "Little visibility", "Tracked from proof to delivery"],
          ].map(([k, a, b]) => (
            <div key={k} className="hx-table-row"><span>{k}</span><span>{a}</span><span>{b}</span></div>
          ))}
        </div>
      </section>

      {/* ===== Questions ===== */}
      <section className="hx-row hx-faq" id="faq">
        <h2 className="hx-h2" data-reveal>Questions</h2>
        <div className="hx-split-side">
          <div className="lp-faq-list">
            {faqs.map((f, i) => <FaqItem key={f.q} q={f.q} a={f.a} style={stagger(i)} />)}
          </div>
          <Link className="hx-link" href="/faq">All questions</Link>
        </div>
      </section>

      {/* ===== Final CTA ===== */}
      <section className="hx-row hx-final">
        <h2 className="hx-h2 hx-final-h" data-reveal>Start with a style</h2>
        <div className="hx-split-side" data-reveal style={stagger(1)}>
          <p className="hx-body">Pick a style, design it on the garment and approve your proof. From {currency(fromLow)}/unit, delivered in {formatLeadTime(lead)}.</p>
          <div className="hx-hero-ctas">
            <Link className="hx-btn hx-btn--primary" href="#styles">Start designing</Link>
            <Link className="hx-btn hx-btn--dark" href="/shop">Browse styles</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
