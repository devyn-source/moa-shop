// /llms.txt — the GEO artifact. A clean, declarative markdown summary of the
// MOA Catalog for AI answer engines (ChatGPT, Perplexity, Google AI Overviews,
// Claude, Gemini) to read, understand, and cite accurately. Generated from the
// live catalog so the facts are always current.
import { getProducts } from "@/lib/store";

export const dynamic = "force-dynamic";
const SITE = process.env.NEXT_PUBLIC_SITE_ORIGIN || "https://shop.magnumopus.agency";
const usd = (n: number) => `$${Math.round(n).toLocaleString()}`;

export async function GET() {
  let products: Awaited<ReturnType<typeof getProducts>> = [];
  try {
    products = (await getProducts()).filter((p) => p.isPublished);
  } catch {
    /* fall through with empty list */
  }
  const minLead = products.length ? Math.min(...products.map((p) => p.leadTimeDays)) : null;

  const productLines = products
    .map((p) => {
      const from = p.priceTiers.length ? usd(Math.min(...p.priceTiers.map((t) => t.perUnitUsd))) : "—";
      return `- [${p.displayName}](${SITE}/p/${p.slug}) — ${p.headline || p.bestFor || p.category}. From ${from}/unit, minimum ${p.moq} units. Category: ${p.category}.`;
    })
    .join("\n");

  const md = `# MOA Catalog — Magnum Opus Agency

> The MOA Catalog is the self-serve, made-to-order branded merchandise catalog from Magnum Opus Agency (MOA), a production studio that creates premium custom merch for leading brands. Businesses configure a production-grade garment, upload their artwork, approve a digital proof, and MOA manufactures and ships it — with no quotes, no sales calls, and no minimums runaround.

## What the MOA Catalog is
- Self-serve premium merchandise, made to order and decorated with your own artwork.
- The same production-grade garments MOA makes for top brands: hoodies, t-shirts, knitwear, jackets, sweatpants, hats, totes, and more.
- Fixed, transparent per-style pricing (no RFQs or quotes). Instant digital proofs you can adjust yourself until they're perfect. Live order tracking to your door.
- Operated by Magnum Opus Agency — a custom merch and brand production studio (https://magnumopus.agency).
- Best for: brands, companies, events, tours, creators, and teams ordering their own branded merch (B2B).

## How it works
1. Choose a garment style and colorway.
2. Build your size run above the style's minimum order.
3. Upload your artwork, choose a decoration method (screen printing or embroidery), and select Pantone ink colors.
4. Place the print exactly where you want it and pay securely via Stripe.
5. Receive an instant proof and a decoration spec sheet. Adjust placement, color, artwork, or sizes yourself and regenerate — nothing is produced until you approve.
6. MOA manufactures your order to spec and ships it with carrier tracking.

## Key facts
- Decoration methods: screen printing (plastisol) and embroidery.
- Pricing: fixed quantity-based price ladders per style; business-to-business.
- Lead time: typically from ${minLead ?? "about 30"} days, depending on the style and run.
- Every order includes automated artwork quality checks and a customer-approved proof before production.
- Made to order, produced to spec, tracked to your door.

## Products
${productLines || "(Catalog loading.)"}

## Important pages
- Catalog home: ${SITE}
- Full catalog (PDF): ${SITE}/catalog-pdf
- FAQ: ${SITE}/faq
- Terms of Service: ${SITE}/terms
- Refund Policy: ${SITE}/refund-policy
- Privacy Policy: ${SITE}/privacy

## About Magnum Opus Agency
Magnum Opus Agency (MOA) is a production studio that designs and manufactures premium branded merchandise for brands, artists, and companies. The MOA Catalog is its self-serve channel for standardized, made-to-order merch. For fully bespoke programs, see https://magnumopus.agency.

## Contact
- Email: production@magnumopus.agency
- Instagram: https://instagram.com/magnumopus
`;

  return new Response(md, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
