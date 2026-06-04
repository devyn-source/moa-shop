# app/ — Next.js App Router

Pages + API routes for the MOA Catalog. Server Components by default; interactivity lives in `components/` (Client Components). Global styles + brand tokens in `app/globals.css`.

## Public pages
- `page.tsx` — homepage: hero, `HomeCatalog` grid, value beats, PDF CTA. FAQ JSON-LD lives on `/faq` now, not here.
- `p/[slug]/page.tsx` — **PDP**: product detail + `PdpConfigurator` (color → size run → artwork → decoration → live price). The core conversion surface.
- `cart/page.tsx` · `checkout/page.tsx` · `checkout/success/page.tsx` — cart → checkout (Supabase account optional, IP attestation required) → confirmation.
- `orders/page.tsx` · `orders/[id]/page.tsx` — customer order list + tracker (status timeline, proof approve, tracking).
- `adjust/[id]/page.tsx` — self-serve re-edit: re-renders `PdpConfigurator` seeded from the order → re-proof (zero-touch changes).
- `catalog-pdf/page.tsx` — print/save-as-PDF full catalog.
- `faq/page.tsx` — dedicated FAQ (grouped, FAQPage JSON-LD; content from `lib/faqs.ts`).
- `terms/` · `privacy/` · `refund-policy/` — legal.
- `login/`, `sign-in/[[...sign-in]]/` — auth entry (Supabase real / Clerk wrap; Clerk is the target).

## SEO / GEO
- `robots.ts` — allow all + explicit AI-crawler allowlist (GPTBot, ClaudeBot, PerplexityBot, …); disallow `/admin /api/ /adjust/ /orders /cart /checkout`.
- `sitemap.ts` — static routes + published products + `/faq`.
- `opengraph-image.tsx` — 1200×630 social card (logo on cream).
- `llms.txt/route.ts` — declarative catalog summary for AI answer engines (GEO).
- `layout.tsx` — root: header/nav (Catalog · Catalog PDF · FAQ), cart provider, Org JSON-LD, footer, metadata.

## Subfolders with their own docs
- `api/` → `app/api/CLAUDE.md` (route handlers)
- `admin/` → `app/admin/CLAUDE.md` (back-office UI, Basic-Auth gated)

## Conventions
- Routes that must not be indexed are in `robots.ts` DISALLOW — keep that list in sync when adding private routes.
- Page-level data comes from `lib/store.ts` (products = file JSON, orders = Supabase).
- Match the brand rules in the root CLAUDE.md; storefront favors product-experience polish + retained conversion info (not bare minimalism).
