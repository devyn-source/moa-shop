# app/api/ — Route handlers

Backend endpoints. Customer routes are public; `admin/*` is HTTP Basic Auth gated by `proxy.ts`; `cron/*` is invoked by Vercel cron.

## Customer / order lifecycle
- `checkout/route.ts` [POST] — build Stripe Checkout session from cart, create the order. Requires `ipAttested`; `automatic_tax` gated by `STRIPE_TAX_ENABLED` (off — B2B). ⚠️ Stripe is LIVE.
- `webhooks/stripe/route.ts` [POST] — on payment success: mark paid → generate proof → email approval → `pushOrderToMoaOS()` (creates `awaiting_approval` card).
- `orders/[id]/approve/route.ts` [POST] — customer approves proof → advances order; MoaOS finalizes PO + (gated) vendor release.
- `orders/[id]/update/route.ts` [POST] — save new config (self-serve edit) → regenerate proof → re-send approval.
- `orders/[id]/request-changes/route.ts` — now just redirects to `/adjust/[id]` (changes are self-serve).
- `catalog/refund/route.ts` [POST] — auth via `MOAOS_INTAKE_SECRET`; Stripe refund (session→payment_intent) + mark cancelled/refunded. Called by MoaOS.
- `upload-artwork/route.ts` [POST] — store artwork; returns `{width,height,density,space}` for print-resolution QA (`MIN_LONG_EDGE=1200`).

## Admin (Basic Auth via proxy.ts)
- `admin/catalog/route.ts`, `admin/catalog/[id]/route.ts` — product list/create/update/delete (writes `.data/products.json`).
- `admin/orders/[id]/route.ts` — order status / vendor / notes mutations.
- `admin/auto-calibrate/[slug]/route.ts` [POST] — silhouette-detect the base mockup, scale to the stored spec, save calibration (`lib/autocalibrate.ts`).
- `admin/email-preview/route.ts` — dev preview of order emails.

## Fulfillment / data / auth
- `cron/fulfillment/route.ts` — Vercel cron (every 15m, see `vercel.json`): proof reminders + status reconciliation (ship→customer email, auto-deliver). ⚠️ gated by `CATALOG_FULFILLMENT_MODE` + `CATALOG_VENDOR_ALLOWLIST` (TEST factory only).
- `zones/[slug]/route.ts` [GET] — placement zones/calibration for a product.
- `auth/callback/route.ts`, `auth/signout/route.ts` — Supabase auth (interim; Clerk is the target).

## Conventions
- Server-only Supabase via `lib/supabase-server.ts`; never expose the service-role key client-side.
- Fulfillment/vendor-send logic lives in `lib/catalog-fulfillment.ts` + `lib/email.ts` — routes are thin wrappers.
- Respect the safety gates (allowlist, fulfillment mode, live Stripe) — see root CLAUDE.md.
