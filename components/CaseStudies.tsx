import Link from "next/link";
import { caseStudiesFor } from "@/lib/case-studies";

// Completed-work showcase. On a PDP, pass the product's `slug` to show only the
// case study for THAT exact product ("this style, in the wild"); on the landing,
// omit it for the full diverse grid. Each card links into the configurator for
// that style ("Make yours →").
export function CaseStudies({ slug, eyebrow }: { slug?: string; eyebrow?: string }) {
  const { items, styleSpecific } = caseStudiesFor(slug);
  if (!items.length) return null;
  const heading = styleSpecific ? "This style, in the wild" : "Merch we've put into the world";
  return (
    <section className="cs" aria-label="Selected work">
      <div className="cs-head">
        <p className="eyebrow">{eyebrow ?? "Selected work"}</p>
        <h2>{heading}</h2>
      </div>
      <div className="cs-grid">
        {items.map((c) => (
          <Link href={`/p/${c.slugs[0]}`} className="cs-card" key={c.id}>
            <div className={`cs-shot${c.fit === "contain" ? " cs-shot--contain" : ""}`}>
              <img src={c.image} alt={c.product} loading="lazy" />
            </div>
            <div className="cs-meta">
              {c.logo ? <img className="cs-logo" src={`/brand/clients/${c.logo}.png`} alt="" loading="lazy" /> : null}
              <p className="cs-product">{c.product}</p>
              <p className="cs-line">{c.line}</p>
              <span className="cs-cta">Make yours <span className="cs-cta-arrow" aria-hidden>→</span></span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
