import { CASE_STUDIES } from "@/lib/case-studies";

// Completed-work showcase below the PDP — social proof, "merch is media."
export function CaseStudies() {
  if (!CASE_STUDIES.length) return null;
  return (
    <section className="cs" aria-label="Selected work">
      <div className="cs-head">
        <p className="eyebrow">Selected work</p>
        <h2>Merch we&apos;ve put into the world</h2>
      </div>
      <div className="cs-grid">
        {CASE_STUDIES.map((c) => (
          <article className="cs-card" key={c.id}>
            <div className="cs-shot">
              <img src={c.image} alt={`${c.brand} — ${c.product}`} loading="lazy" />
            </div>
            <div className="cs-meta">
              <img className="cs-logo" src={`/brand/clients/${c.logo}.png`} alt={c.brand} loading="lazy" />
              <p className="cs-product">{c.product}</p>
              <p className="cs-line">{c.line}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
