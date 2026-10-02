import type { Metadata } from "next";
import Link from "next/link";
import { FAQ_GROUPS, FAQ_JSONLD } from "@/lib/faqs";
import { PageHero } from "@/components/hx/PageHero";

const SITE = process.env.NEXT_PUBLIC_SITE_ORIGIN || "https://shop.magnumopus.agency";

export const metadata: Metadata = {
  title: "FAQ | MOA Shop",
  description:
    "How the MOA Shop works: custom cut and sew merch for smaller orders, minimums and pricing, proofs and changes, decoration methods, production and delivery. Answers from Magnum Opus Agency.",
  alternates: { canonical: `${SITE}/faq` },
  openGraph: {
    title: "FAQ | MOA Shop",
    description:
      "How the MOA Shop works: ordering, pricing, proofs, decoration, production and delivery.",
    url: `${SITE}/faq`,
  },
};

export default function FaqPage() {
  return (
    <main className="hx">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSONLD) }} />

      <PageHero title="Questions">
        <p className="hx-body">How made-to-order works, what it costs, how proofs and changes are handled, and how your order reaches you.</p>
      </PageHero>

      {FAQ_GROUPS.map((group) => (
        <section className="hx-row hx-qa" key={group.title}>
          <h2 className="hx-qa-group">{group.title}</h2>
          <div className="hx-qa-list">
            {group.items.map((f) => (
              <div className="hx-qa-item" key={f.q}>
                <h3>{f.q}</h3>
                <p>{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="hx-row hx-final">
        <h2 className="hx-h2 hx-final-h">Still have a question?</h2>
        <div className="hx-split-side">
          <p className="hx-body">Email <a href="mailto:production@magnumopus.agency">production@magnumopus.agency</a> and the studio will help.</p>
          <div className="hx-hero-ctas">
            <Link className="hx-btn hx-btn--primary" href="/shop">Start designing</Link>
            <a className="hx-btn hx-btn--dark" href="mailto:production@magnumopus.agency">Email the studio</a>
          </div>
        </div>
      </section>
    </main>
  );
}
