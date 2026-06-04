# app/admin/ — Back-office operator UI

Operator dashboard for MOA staff. **Gated by HTTP Basic Auth** in `proxy.ts` (`ADMIN_USER` / `ADMIN_PASSWORD`). Excluded from indexing (`robots.ts`). Pairs with the `app/api/admin/*` handlers.

## Pages
- `page.tsx` — dashboard: open-order count, revenue, product metrics (MOA OS stat-card style).
- `catalog/page.tsx` · `catalog/[id]/page.tsx` — product list + editor (variants, price ladders, decorations, visibility). Writes `.data/products.json`.
- `orders/page.tsx` · `orders/[id]/page.tsx` — order queue + detail: artwork QA, request revision, vendor routing, fulfillment tracking.
- `vendors/page.tsx` — vendor directory.
- `zones/page.tsx` — **placement-zone + calibration** config per SKU. This is where grading specs get auto-calibrated (one click → `api/admin/auto-calibrate/[slug]`) and nudged in Studio.

## Calibration workflow (intricate — see root CLAUDE.md "Spec → calibration → placement")
A SKU needs `product_zones.measurements` (loaded from a factory grading spec, base size M) before auto-calibrate can scale its base mockup. After calibration, `lib/zones.ts derivePlacement()` converts configurator print boxes to real inches for the vendor decoration sheet.

## Conventions
- All admin mutations go through `app/api/admin/*` (Basic Auth), not direct client writes.
- Uses the same brand tokens/components as the storefront; keep MOA OS operational proportions.
