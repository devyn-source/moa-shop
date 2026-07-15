// Single source of truth for the MOA Catalog FAQ. Rendered on /faq and emitted
// as FAQPage JSON-LD there for search + AI answer engines (GEO). Grounded only
// in how the catalog actually works — no invented policy.

export type Faq = { q: string; a: string };
export type FaqGroup = { title: string; items: Faq[] };

export const FAQ_GROUPS: FaqGroup[] = [
  {
    title: "The basics",
    items: [
      {
        q: "What is the MOA Catalog?",
        a: "The MOA Catalog is the self-serve, made-to-order branded merch catalog from Magnum Opus Agency. You configure a production-grade garment, upload your artwork, approve a digital proof, and MOA manufactures and ships it — with no quotes, no sales calls, and no minimums runaround.",
      },
      {
        q: "How does made-to-order merch work?",
        a: "Choose a style and color, build your size run, upload your artwork, pick a decoration method and ink colors, and place the print where you want it. You pay securely, receive an instant proof and decoration spec sheet, and approve it. Nothing is produced until you approve. MOA then manufactures to spec and ships with tracking.",
      },
      {
        q: "Who is Magnum Opus Agency?",
        a: "Magnum Opus Agency (MOA) is a production studio that designs and manufactures premium branded merchandise for brands, artists, and companies. The MOA Catalog is its self-serve channel for standardized, made-to-order merch. For fully bespoke programs, see magnumopus.agency.",
      },
    ],
  },
  {
    title: "Ordering & pricing",
    items: [
      {
        q: "Is there a minimum order?",
        a: "Each style has a minimum run (its MOQ), shown on the product page. Pricing is set on fixed quantity-based ladders — the more you order, the lower the per-unit price. There are no hidden fees and no RFQs; the price you see is the price you pay.",
      },
      {
        q: "How do I pay?",
        a: "Securely by card at checkout, powered by Stripe. You pay when you place the order, then receive your proof to approve. Nothing goes into production until you approve that proof. Need to pay by invoice or PO instead? There's a request link at checkout — a real person replies within one business day.",
      },
      {
        q: "What artwork files can I upload?",
        a: "High-resolution raster files (PNG or JPG) or vector files (SVG or PDF). The configurator runs an automatic resolution check at your chosen print size and warns you before you order if a file is too low-resolution to print sharply — so you never approve art that won't hold up.",
      },
    ],
  },
  {
    title: "Proofs & changes",
    items: [
      {
        q: "Can I change the artwork or placement after I order?",
        a: "Yes. Before you approve your proof you can adjust the placement, garment color, ink colors, artwork file, and size run yourself, and a fresh proof regenerates instantly — as many times as you like. Nothing is made until you approve.",
      },
      {
        q: "What decoration methods are available?",
        a: "Screen printing (plastisol), embroidery, and rubber appliqué, with Pantone ink color selection — plus woven labels sewn in as an add-on. Every order goes through automated artwork quality checks and a customer-approved proof before production.",
      },
    ],
  },
  {
    title: "Production & delivery",
    items: [
      {
        q: "How long does it take?",
        a: "Lead time depends on the style and run size, and is shown on each product page. Because everything is made to order, production begins once you approve your proof.",
      },
      {
        q: "How do I track my order?",
        a: "You get live status from approval through production to delivery, and carrier tracking is emailed the moment your order ships.",
      },
    ],
  },
];

export const ALL_FAQS: Faq[] = FAQ_GROUPS.flatMap((g) => g.items);

export const FAQ_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: ALL_FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};
