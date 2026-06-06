import type { Metadata } from "next";
import Link from "next/link";
import { FAQ_GROUPS, FAQ_JSONLD } from "@/lib/faqs";

const SITE = process.env.NEXT_PUBLIC_SITE_ORIGIN || "https://shop.magnumopus.agency";

export const metadata: Metadata = {
  title: "FAQ · MOA Catalog",
  description:
    "How the MOA Catalog works — made-to-order merch, minimums and pricing, proofs and changes, decoration methods, production and delivery. Answers from Magnum Opus Agency.",
  alternates: { canonical: `${SITE}/faq` },
  openGraph: {
    title: "FAQ · MOA Catalog",
    description:
      "How the MOA Catalog works — ordering, pricing, proofs, decoration, production and delivery.",
    url: `${SITE}/faq`,
  },
};

export default function FaqPage() {
  return (
    <main className="page faq-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSONLD) }} />

      <header className="faq-page-head">
        <p className="eyebrow">MOA Catalog</p>
        <h1 className="page-title">Frequently asked questions</h1>
        <p className="lede">
          Everything you need to know before you order — how made-to-order works, what it costs,
          how proofs and changes are handled, and how your order reaches you.
        </p>
      </header>

      <div className="faq-page-body">
        {FAQ_GROUPS.map((group) => (
          <section className="faq-page-group" key={group.title}>
            <div className="faq-page-group-label">
              <h2>{group.title}</h2>
            </div>
            <div className="faq-page-items">
              {group.items.map((f) => (
                <div className="faq-page-item" key={f.q}>
                  <h3>{f.q}</h3>
                  <p>{f.a}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="faq-page-foot">
        <div>
          <p className="eyebrow">Still have a question?</p>
          <h2>Talk to the studio</h2>
          <p className="faq-page-foot-copy">
            Need something the catalog can&apos;t do, or have a question we haven&apos;t answered?
            Email <a href="mailto:production@magnumopus.agency">production@magnumopus.agency</a> and we&apos;ll help.
          </p>
        </div>
        <Link className="button button--lg" href="/shop">Browse the catalog →</Link>
      </section>
    </main>
  );
}
