# lib/ — Data access, domain logic, integrations

Server-side utilities. Storefront/admin pages and API routes pull from here.

## Data & types
- `types.ts` — domain types: `CatalogProduct`, `CatalogVariant`, `CatalogDecoration`, `PriceTier`, `OrderStatus`, `ShopOrder`, `Vendor`, `CATALOG_FULFILLMENT_MODE`.
- `store.ts` — persistence. **Products = file JSON** (`.data/products.json`, seeded from `seed.ts`; tech debt — should move to Supabase). **Orders = Supabase** (`orders` table, payload in `data` jsonb). Also `product_zones` measurements/calibration helpers (`getProductMeasurements`, `saveProductCalibration`).
- `seed.ts` — **canonical catalog source**: 14 SKUs, the `PALETTE` (9-color system) + per-SKU `colorways()` sets, price ladders, `coreDecorations`, `seedVendors`. Edit pricing/colors here.

## Pricing
- `pricing.ts` — `currency()`, `formatLeadTime()`, price-tier selection, order totals. Rule: price = LDP ÷ 0.40 (60% floor). Use `??` (not `||`) for numeric fallbacks where 0 is valid.

## Fulfillment & production
- `catalog-fulfillment.ts` — the MoaOS pipeline: `buildIntakePayload()` (+`approved` flag), PO creation/release, gated by `CATALOG_FULFILLMENT_MODE` + **`CATALOG_VENDOR_ALLOWLIST` (TEST factory only — go-live gate)**.
- `zones.ts` — measurements types (`ProductMeasurements`/`PointOfMeasure`), `normaliseMeasurements()`, calibration types, `derivePlacement()` (print box → real inches, wearer-relative CF/CB labels).
- `autocalibrate.ts` — detect garment silhouette in base mockup (sharp), scale to body-length spec, emit calibration + confidence.
- `decoration-sheet.ts` — vendor decoration spec (HPS offsets, CF/CB callouts); rendered via moa-pdf.
- `proof.ts` — proof/mockup generation.

## Email & payments
- `email.ts` — transactional email. `deliver()` prefers **Resend** (`RESEND_FROM_EMAIL` = `production@magnumopus.agency`), falls back to N8N. `sendProofApproval()`, `renderProofHtml()` (self-serve "Redo it yourself" link), `notifyOps()`.
- `stripe.ts` — Stripe SDK init + Checkout/webhook helpers. ⚠️ LIVE keys.

## Auth (Supabase clients; Clerk is the target)
- `supabase.ts` (shared), `supabase-browser.ts` (client), `supabase-server.ts` (server, service-role — never expose client-side).

## Reference
- `pantones.ts` — Pantone TCX lookup. · `faqs.ts` — grouped FAQ content + FAQPage JSON-LD (rendered on `/faq`).
