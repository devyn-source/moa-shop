import Link from "next/link";
import { HomeCatalog } from "@/components/HomeCatalog";
import { getProducts } from "@/lib/store";

// Direct Q&A — citable by AI answer engines + eligible for Google rich results.
const FAQS: { q: string; a: string }[] = [
  {
    q: "What is the MOA Catalog?",
    a: "The MOA Catalog is the self-serve, made-to-order branded merch catalog from Magnum Opus Agency. You configure a production-grade garment, upload your artwork, approve a digital proof, and MOA manufactures and ships it — with no quotes, no sales calls, and no minimums runaround.",
  },
  {
    q: "How does made-to-order merch work?",
    a: "Choose a style and color, build your size run, upload your artwork, pick a decoration method and ink colors, and place the print where you want it. You pay securely, receive an instant proof and decoration spec sheet, and approve it. Nothing is produced until you approve. MOA then manufactures to spec and ships with tracking.",
  },
  {
    q: "Is there a minimum order?",
    a: "Each style has a minimum run (its MOQ), shown on the product page. Pricing is set on fixed quantity-based ladders — the more you order, the lower the per-unit price.",
  },
  {
    q: "Can I change the artwork or placement after I order?",
    a: "Yes. Before you approve your proof you can adjust the placement, garment color, ink colors, artwork file, and size run yourself, and a fresh proof regenerates instantly — as many times as you like. Nothing is made until you approve.",
  },
  {
    q: "What decoration methods are available?",
    a: "Screen printing (plastisol) and embroidery, with Pantone ink color selection. Every order goes through automated artwork quality checks and a customer-approved proof before production.",
  },
  {
    q: "Who is Magnum Opus Agency?",
    a: "Magnum Opus Agency (MOA) is a production studio that designs and manufactures premium branded merchandise for brands, artists, and companies. The MOA Catalog is its self-serve channel for standardized, made-to-order merch.",
  },
];

const FAQ_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default async function HomePage() {
  const products = await getProducts();

  return (
    <main className="page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSONLD) }} />
      <section className="catalog-intro">
        <div className="catalog-intro-text">
          <p className="eyebrow">The MOA Catalog</p>
          <h1 className="page-title">Production-grade merch, made to order.</h1>
          <p className="lede">
            Choose a premium blank, build your run by size, and upload your artwork. MOA manufactures it
            to spec and ships it to you — no quotes, no sales calls, no minimums runaround. The self-serve
            side of the studio brands trust for their best merch.
          </p>
        </div>
      </section>

      <HomeCatalog products={products} />

      <section className="value-strip" aria-label="How it works">
        <div className="value-card">
          <span className="value-num">01</span>
          <h3>No quotes, ever</h3>
          <p>One transparent price ladder per style. What you see is what you pay — no RFQs, no sales calls, no back-and-forth.</p>
        </div>
        <div className="value-card">
          <span className="value-num">02</span>
          <h3>Your proof, instantly</h3>
          <p>Upload your art and see exactly how it prints. Adjust placement, color and size yourself until it&apos;s right — then approve. Nothing is made until you do.</p>
        </div>
        <div className="value-card">
          <span className="value-num">03</span>
          <h3>Production-grade blanks</h3>
          <p>Every style is a garment we already make for top brands — curated and decoration-ready, not an endless generic catalog.</p>
        </div>
        <div className="value-card">
          <span className="value-num">04</span>
          <h3>Tracked to your door</h3>
          <p>Live status from approval through production to delivery, with carrier tracking emailed the moment it ships.</p>
        </div>
      </section>

      <section className="faq" aria-label="Frequently asked questions" style={{ margin: "8px 0 4px" }}>
        <p className="eyebrow" style={{ color: "var(--color-terracotta)" }}>Questions</p>
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.4rem", textTransform: "uppercase", letterSpacing: "0.04em", margin: "6px 0 18px" }}>How it works</h2>
        <div style={{ display: "grid", gap: 18, maxWidth: 760 }}>
          {FAQS.map((f) => (
            <div key={f.q}>
              <h3 style={{ fontSize: "0.98rem", fontWeight: 700, color: "var(--color-charcoal)", margin: "0 0 4px" }}>{f.q}</h3>
              <p style={{ fontSize: "0.9rem", lineHeight: 1.6, color: "var(--color-neutral)", margin: 0 }}>{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="cta-strip">
        <div>
          <p className="eyebrow">The full range</p>
          <h2>Browse the complete catalog as a PDF</h2>
        </div>
        <Link className="button button--lg" href="/catalog-pdf">
          View PDF →
        </Link>
      </section>
    </main>
  );
}
