import { caseStudiesFor } from "@/lib/case-studies";
import type { ProductCategory } from "@/lib/types";

// Completed-work showcase. On a PDP, pass the product's `category` to show
// style-specific proof ("this style, in the wild"); on the landing, omit it for
// the full diverse grid.
export function CaseStudies({ category, eyebrow }: { category?: ProductCategory; eyebrow?: string }) {
  const { items, styleSpecific } = caseStudiesFor(category);
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
          <article className="cs-card" key={c.id}>
            <div className={`cs-shot${c.fit === "contain" ? " cs-shot--contain" : ""}`}>
              <img src={c.image} alt={c.product} loading="lazy" />
            </div>
            <div className="cs-meta">
              {c.logo ? <img className="cs-logo" src={`/brand/clients/${c.logo}.png`} alt="" loading="lazy" /> : null}
              <p className="cs-product">{c.product}</p>
              <p className="cs-line">{c.line}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
