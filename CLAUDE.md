# MOA Catalog (moa-shop) — Project Guide

The **MOA Catalog** is a self-serve, B2B, made-to-order premium merch storefront by **Magnum Opus Agency (MOA)**. A customer (typically a tech startup) configures a production-grade blank, uploads artwork, pays, approves an instant digital proof, and MOA manufactures + ships it — no quotes, no sales calls. It is the productized, zero-sales-labor channel of the MOA agency.

Present it as **MOA Catalog** (or *Standardized MOA Catalog*) in user-facing copy — never "MOA Shop" except for the repo/package name.

---

## Relationship to the larger MOA system

moa-shop is one of several MOA apps and is **intentionally isolated** (no code imports across repos):

- **MoaOS** (`~/moa-os`, Supabase `dzrwsorqhwepcfusklqx`) — internal ops system. moa-shop is its **brand source of truth** and pushes paid+approved orders to it as POs (see `lib/catalog-fulfillment.ts`). MoaOS handles vendor fulfillment, finance, T&A.
- **moa-pdf** (`~/moa-pdf`, moa-pdf-fawn.vercel.app) — renders branded PDFs (decoration spec sheets, tech packs).
- **Client portal / Vendor portal** — sibling MOA portals; not directly wired to moa-shop yet.
- moa-shop has its **own Supabase project** (`ntppmyydbmwweosuavuw`), separate from MoaOS.

---

## Tech stack

- **Next.js 16** (App Router) · **React 19** · TypeScript (strict) · path alias `@/*` → repo root
- **Supabase** (`@supabase/ssr`) — orders, `product_zones` (measurements + calibration), customer auth
- **Stripe** (`stripe@22`) — Checkout + webhooks. ⚠️ **LIVE keys** — real charges; be careful testing.
- **Resend** — transactional email (from `production@magnumopus.agency`); N8N Gmail is the fallback
- **Clerk** — optional auth wrapper (see Auth below)
- **Python** (`scripts/.venv`: PIL, rembg) — product-shot background removal + recolor masks
- Hosting: **Vercel** — ⚠️ **auto-deploys on `git push` to main** (no manual deploy step; changes go live immediately)

---

## Run locally

```bash
npm install
npm run dev -- --port 3040      # http://localhost:3040
```

Needs `.env.local` (see `.env.example`). Without Supabase/Stripe/Resend keys, product browsing works (file-based) but orders/checkout/email won't.

```bash
npm run typecheck   # tsc --noEmit  — run after every change
npm run build       # next build    — run before considering done
```

Deploy = `git push` (Vercel auto-builds main). There is no `vercel --prod` step for this repo.

---

## Project structure

```
app/            Next.js App Router — pages + API routes (see app/CLAUDE.md)
  api/          Backend route handlers (see app/api/CLAUDE.md)
  admin/        Basic-Auth back-office UI (see app/admin/CLAUDE.md)
  p/[slug]/     Product detail + configurator (PDP)
  globals.css   Brand tokens + all global styles
lib/            Data access, pricing, fulfillment, auth, integrations (see lib/CLAUDE.md)
components/     React components — storefront, configurator, admin, studio (see components/CLAUDE.md)
scripts/        Python image-processing utilities (see scripts/CLAUDE.md)
public/brand/   MOA logos + Archivo fonts (see public/brand/CLAUDE.md)
docs/           Architecture + spec docs (see docs/CLAUDE.md)
.data/          Local JSON persistence for PRODUCTS (runtime; orders are in Supabase)
proxy.ts        Middleware: /admin Basic Auth + Supabase session refresh
seed.ts (lib/)  Canonical catalog data: 14 SKUs, pricing ladders, 9-color PALETTE, vendors
```

---

## Data model & persistence (hybrid — note the split)

- **Products → file-based JSON.** `lib/store.ts` reads/writes `.data/products.json`, seeded from `lib/seed.ts`. ⚠️ **Tech debt:** products should migrate to Supabase like orders did. Documented here as a known gap.
- **Orders → Supabase** (`orders` table; the order payload is a `data` jsonb blob). Status flow: `awaiting_approval → received → ready_to_send → sent → in_production → shipped → delivered` (+ `cancelled`).
- **Measurements & calibration → Supabase** (`product_zones` table: `measurements`, `calibration`, `zones` columns, conflict on `product_slug`).

## Auth (hybrid; Clerk is the target)

The code runs **both**: Clerk optionally wraps the app (`app/layout.tsx` `MaybeClerk`, `/sign-in`), but **Supabase currently does the real customer auth** (checkout, `/orders`, `AccountNav`, `/auth/callback`, `/auth/signout`). **Direction: Clerk is the intended customer auth** — the Supabase auth path is interim and the migration is incomplete. Document new auth work against Clerk; don't deepen the Supabase auth path.

---

## Pricing model (see lib/pricing.ts, lib/seed.ts)

- `vendorUnitCostUsd` = full **LDP landed cost** (blank + freight + duty, delivered).
- Garment price = **landed ÷ 0.40** (60% floor margin); ladders step 68%→60% from entry (MOQ 50) to volume floor.
- Decoration + (future) woven labels are **flat add-ons** priced at cost + margin — never folded into the garment margin.
- Full rationale: memory `project_moa_shop_costing.md`; plan docs in `~/Desktop/business-context/`.

## Colorways (see lib/seed.ts `PALETTE`)

Canonical 9-color system: 6 core neutrals (Jet Black, Bone, Natural, Heather Gray, Ink, Navy) + 3 accents (Forest, Oxblood, Walnut). Each color has a Pantone TCX (production) + sRGB hex (screen). Each SKU offers a hero-ordered category subset via `colorways(slug, label, fabric, ids[])`.

---

## ⚠️ Critical safety rules

- **GO-LIVE VENDOR GATE.** `CATALOG_VENDOR_ALLOWLIST` gates ALL vendor sends to the **TEST factory only**. Do **not** add a real vendor / flip the allowlist until Devyn gives an explicit go-live phrase. Real vendors are the LAST step, after beta. `CATALOG_FULFILLMENT_MODE` (`off|dry_run|draft_only|manual_release|auto`) further gates MoaOS PO creation.
- **Stripe is LIVE** — test against the hidden `/p/test-sku` ($1, MOQ 1), never real SKUs.
- **Auto-deploy on push** — a push to main is a production deploy. Typecheck + build first.
- **Numeric fallbacks:** use `??` not `||` where 0 is valid (e.g. deposit/cost fields).

## Architecture flow (happy path)

1. Browse (`/`, `HomeCatalog`) → PDP (`/p/[slug]`, `PdpConfigurator`): pick color, build size run, upload art, place decoration, see live price.
2. Cart → `/checkout` (Supabase account optional) → `POST /api/checkout` → Stripe Checkout (LIVE).
3. `POST /api/webhooks/stripe` on payment → generate proof → email approval (Resend) → push to MoaOS (`awaiting_approval`).
4. Customer approves proof (or self-edits via `/adjust/[id]` → re-proof). Approval → MoaOS finalizes PO + (gated) vendor release.
5. Vendor accepts → in_production → ship → `/api/cron/fulfillment` reconciles → customer tracking email → auto-deliver.

## Spec → calibration → placement pipeline

Factory grading specs (xlsx) → parsed into `product_zones.measurements` (POMs × sizes, base size M, XS graded) → `/admin/zones` auto-calibrate (`lib/autocalibrate.ts`, silhouette detect + scale to body-length spec) → `lib/zones.ts` `derivePlacement()` maps the configurator's print box to real inches → `lib/decoration-sheet.ts` renders the vendor spec sheet. Intricate; change carefully.

---

## Brand — match MOA OS exactly (do not approximate)

Source of truth: `~/moa-os` (`src/app/globals.css`, `sidebar.tsx`, `stat-card.tsx`, `page-header.tsx`). Local assets in `public/brand/`.

```css
--color-cream:#EEEAE3; --color-cream-dark:#E2DED6; --color-charcoal:#1E1E1E;
--color-terracotta:#B04731; --color-terracotta-light:#C45A42;
--color-success:#3D7A4A; --color-warning:#C4880D; --color-danger:#B04731; --color-neutral:#8A8680;
--font-display:"Archivo",sans-serif; --font-body:-apple-system,BlinkMacSystemFont,"Segoe UI","Inter",Helvetica,Arial,sans-serif;
--background:#EEEAE3; --foreground:#1E1E1E; --card:#FFFFFF; --muted:#E2DED6;
--border:#E2DED6; --input:#E2DED6; --ring:#B04731; --radius:0.5rem;
```

**Visual rules:** feel like MOA OS, not generic ecommerce. Compact operational proportions. Page titles ~1.4–1.8rem uppercase Archivo Expanded — no oversized marketing hero type. Cards white, cream-dark border, subtle shadow, 8–10px radius. Labels tiny uppercase Archivo (0.58–0.65rem, positive tracking). Primary action = terracotta bg / white text; secondary = white bg / cream-dark border / charcoal text.

**Storefront-specific direction (this session):** the catalog is for tech-startup buyers — luxury = the *product experience* (clean gallery, instant proof, frictionless flow), NOT stripped-bare minimalism. Keep conversion-useful info (specs, FAQ at `/faq`); don't remove clarity to look sparse. See memory `feedback_moa_shop_startup_luxe.md`.

## Naming
**MOA Catalog** in user copy; **moa-shop** for the repo/package only.

## Known notes / gotchas
- Products in `.data/` JSON is tech debt (migrate to Supabase).
- Auth is hybrid (Clerk wrap + Supabase real) — Clerk is the target.
- Browser-extension attributes (e.g. `data-foxclocks-*` on `<html>`) cause harmless dev hydration warnings.
- Planning docs (business plan, sample brief) live in `~/Desktop/business-context/moa-catalog-*.md`.
