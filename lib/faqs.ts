// Single source of truth for the MOA Shop FAQ. Rendered on /faq and emitted
// as FAQPage JSON-LD there for search + AI answer engines (GEO). Grounded only
// in how the catalog actually works — no invented policy.

export type Faq = { q: string; a: string };
export type FaqGroup = { title: string; items: Faq[] };

export const FAQ_GROUPS: FaqGroup[] = [
  {
    title: "The basics",
    items: [
      {
        q: "What is the MOA Shop?",
        a: "The MOA Shop is the self-serve side of Magnum Opus Agency, built for smaller orders. Every style is fully custom, cut and sewn to our own patterns. You design it on the garment and pay at checkout. Our team prepares your production proof by the end of the next business day. Once you approve it, we make it with our factory partners and ship it.",
      },
      {
        q: "How does made-to-order merch work?",
        a: "Choose a style and colour, build your size run, upload your artwork, pick a decoration method, and place the print on the garment. You see your mockup as you design. Pay for the full order at checkout. The MOA team reviews your artwork and your production proof arrives by the end of the next business day. Approve it or request a change in your account. Production starts after approval. We produce it to spec and ship it with tracking.",
      },
      {
        q: "Who is Magnum Opus Agency?",
        a: "Magnum Opus Agency (MOA) is a Los Angeles studio of designers, producers and engineers. We design, develop and produce custom product for festivals, enterprise teams and fashion labels. The MOA Shop is where smaller runs start, cut and sewn to our own patterns.",
      },
    ],
  },
  {
    title: "Ordering and pricing",
    items: [
      {
        q: "Is there a minimum order?",
        a: "Each style has a minimum run (its MOQ), shown on the product page. Pricing is set on fixed quantity-based ladders: the more you order, the lower the per-unit price. There are no hidden fees. The price you see is the price you pay.",
      },
      {
        q: "How do I pay?",
        a: "You pay the full order total by card at checkout. Your first production proof follows payment, by 5 p.m. Pacific on the next business day (Monday to Friday). Review it or request a change in your account. Nothing goes into production until you approve. Need a PO or net terms? There's a request link at checkout, and a real person replies within one business day.",
      },
      {
        q: "What artwork files can I upload?",
        a: "High-resolution raster files (PNG or JPG) or vector files (SVG or PDF). The configurator runs an automatic resolution check at your chosen print size and warns you before you order if a file is too low-resolution to print sharply, before you approve anything.",
      },
    ],
  },
  {
    title: "Proofs and changes",
    items: [
      {
        q: "Can I change the artwork or placement after I order?",
        a: "Yes. Before you approve your proof you can request changes to the placement, garment colour, ink colours, artwork file, and size run from your account. Our team updates the proof and sends it back for approval. Your first proof and one revision round are included. Nothing is made until you approve.",
      },
      {
        q: "What decoration methods are available?",
        a: "Screen printing (plastisol), embroidery, and rubber appliqué, with Pantone ink colour selection, plus woven labels sewn in as an add-on. Every order goes through artwork checks by the MOA team and a customer-approved proof before production.",
      },
    ],
  },
  {
    title: "Production and delivery",
    items: [
      {
        q: "How long does it take?",
        a: "Lead time depends on the style and run size, and is shown on each product page. Because everything is made to order, production begins once you approve your proof.",
      },
      {
        q: "How do I track my order?",
        a: "Your account shows the status from approval to delivery. Carrier tracking is emailed when your order ships.",
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
