// /llms.txt, the GEO artifact. A clean, declarative markdown summary of the
// MOA Shop for AI answer engines (ChatGPT, Perplexity, Google AI Overviews,
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
      const from = p.priceTiers.length ? usd(Math.min(...p.priceTiers.map((t) => t.perUnitUsd))) : "on request";
      return `- [${p.displayName}](${SITE}/p/${p.slug}): ${p.headline || p.bestFor || p.category} From ${from}/unit, minimum ${p.moq} units.`;
    })
    .join("\n");

  const md = `# MOA Shop by Magnum Opus Agency

> MOA Shop is the self-serve lane for smaller orders from Magnum Opus Agency (MOA), a Los Angeles product design studio. Every style is custom cut and sewn to MOA's own patterns. Customers design their piece on the garment, receive a proof from the MOA team within 24 business hours, and pay one invoice for the full order before production.

## What MOA Shop is
- Fully custom apparel and accessories for smaller orders, cut and sewn to MOA's own patterns.
- Six styles at launch: heavyweight tee, pullover hoodie, fleece sweatpant, dad cap, rib knit beanie and canvas tote.
- Fixed per-style price ladders by quantity. No quotes and no sales calls.
- Operated by Magnum Opus Agency, a product design, development and production studio.
- Best for brands, companies, events, tours, creators and teams ordering their own branded product.

## How it works
1. Choose a style, colour and fabric.
2. Upload your artwork and place it on the 3D garment. Choose a decoration method and Pantone ink colours.
3. Build your size run above the style's minimum and submit the order. Nothing is charged at this step.
4. The MOA team prepares your proof within 24 business hours. Approve each piece or request a change in your account. Two proof rounds are included.
5. Pay one invoice for the full order.
6. MOA produces the order to spec with its partner factories, runs QC and ships it with tracking.

## Key facts
- Decoration: screen printing, embroidery and rubber appliqué, with woven labels as an add-on.
- Pricing: fixed quantity-based price ladders per style.
- Lead time: typically from ${minLead ?? "about 30"} days after proof approval and payment.
- Nothing is produced until the customer approves the proof and pays the invoice.

## Products
${productLines || "(Styles loading.)"}

## Important pages
- Shop home: ${SITE}
- All styles: ${SITE}/shop
- FAQ: ${SITE}/faq
- Terms of Service: ${SITE}/terms
- Refund Policy: ${SITE}/refund-policy
- Privacy Policy: ${SITE}/privacy

## About Magnum Opus Agency
Magnum Opus Agency (MOA) is a product design studio that designs, develops and produces custom product for brands, artists and companies. MOA Shop is its self-serve lane for smaller orders.

## Contact
- Email: production@magnumopus.agency
- Instagram: https://instagram.com/magnumopus
`;

  return new Response(md, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
