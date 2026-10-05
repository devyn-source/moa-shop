# MOA Catalog launch offer readiness

Stage 1 working record, checked October 5, 2026. This document defines the evidence needed to finalize the eight launch offers. Devyn confirmed that final LDP costing is not available. Selling prices below are previously accepted targets; costs, decoration coverage and delivery estimates remain provisional.

No style is cleared for unrestricted production ordering by this audit. That means the required evidence is incomplete, not that physical samples have failed. Sample approvals have not yet been supplied or located in the records reviewed. This document does not change catalog prices, product visibility, payment mode or vendor release settings.

## Current evidence by product

All eight products have MOQ 50 in the production catalog and committed 2D mockup plates. Plates are presentation and placement assets, not proof of physical sample approval. Database passport status and unresolved fields were read directly from production on October 5. Measurement rows establish stored data, not independently verified factory acceptance.

| Product | Recorded supplier reference | Passport evidence | Stored measurements | Current delivered lead time | Main action before clearance |
| --- | --- | --- | --- | --- | --- |
| Heavyweight Tee | Best Cover | Draft; 9 assumed fields and 3 open questions | XS to XXL, 11 POMs | 42 days | Confirm fabric, construction, labels, flats and sample; reconcile legacy 3D body length with graded measurements |
| Vintage Cut Tee | Best Cover | Draft; 9 assumed fields and 4 open questions | No dedicated product_zones measurement row | 42 days | Locate and validate its own graded pattern/spec; confirm independent fit, fabric, labels and sample |
| Heavyweight Hoodie | Best Cover | Draft; 10 assumed fields and 5 open questions | XS to XXL, 22 POMs | 56 days | 480gsm cotton fleece selected by Devyn; update draft passport and confirm hood, drawcord, eyelets, labels and sample later |
| Canvas Work Jacket | Best Cover | Draft; 10 assumed fields and 5 open questions | S to XXL, 24 POMs | 70 days | Confirm shell, lining, collar, hardware, labels and sample; clarify flat versus circumference measurements |
| Track Jacket | Best Cover | Draft; 10 assumed fields and 5 open questions | XS to 3XL, 20 POMs; catalog offers XS to XXL | 50 days | Confirm shell, lining, closures, finishing and sample; explicitly choose offered size range |
| Dad Hat | Headwear partner reference | Missing | Missing | 42 days | Identify actual supplier; create cap construction, fit, closure, decoration and packaging spec; approve sample |
| Rib Knit Beanie | Headwear partner reference | Missing | Missing | 38 days | Identify actual supplier; create yarn, gauge, dimensions, stretch recovery, cuff and decoration spec; approve sample |
| Standard Tote | Best Cover | Missing | Missing | 45 days | Create canvas weight, dimensions, handle, seam, load and decoration spec; approve sample |

Supplier references are storefront identifiers, not verified Express release mappings. The seed vendor contacts use example.com placeholders; the headwear supplier name is generic. Confirm actual vendor identity and the MoaOS mapping before use. Do not treat the historical sample brief's Best Cover coverage as a current confirmed supplier assignment for headwear.

## Specifications that need reconciliation

1. **Hoodie fabric:** current catalog base fabric is 480gsm, 100% cotton; draft passport says 420gsm brushed cotton/poly. Devyn selected 480gsm cotton fleece. Reconcile the passport, quote, sample and factory tech pack in the deferred physical-product workstream.
2. **Work Jacket lining:** catalog specifies acetate for the base version and lyocell twill for premium; passport still asks whether the body is lined. Confirm one actual base construction and quote it.
3. **Track Jacket construction:** catalog specifies nylon Taslan with mesh lining; passport contains generic recycled nylon, taffeta-or-mesh lining and zipper-or-snap alternatives. Replace alternatives with confirmed components.
4. **Vintage Cut Tee:** its own 2D plates exist and take precedence over the legacy 3D fallback. The zones endpoint can still fall back to Heavyweight Tee data. Verify measurements and placement limits against the Vintage pattern. The passport says S to 3XL grading is on file, but that source was not located in this audit.
5. **Legacy calibration:** Heavyweight Tee stores a 27.48-inch 3D body length versus 29 inches for size M in the measurements. Work Jacket stores 48 as chestWidthIn, which may represent circumference rather than flat width. Verify source conventions before using those values in factory specifications. Do not infer that the currently preferred 2D plates have the same error.
6. **Packaging and labels:** all five existing passports mark labels and packaging as assumed. Separate standard care/size labels from paid customer branding; confirm folding, individual protection, cartons and any hangtags before including them in costs.
7. **Premium options:** current adders are not evidence of confirmed vendor quotes. Historical call sheet explicitly called these placeholders. Hold each premium fabric until its construction, sample, cost and lead time are confirmed.

## Accepted price targets

USD per unit, MOQ 50. The planning basis is base fabric, one standard decoration and included standard US delivery. Decoration limits and cost coverage are not yet confirmed. Applicable sales tax must be handled separately in Stage 2. Quantities are target price anchors, not an authorization to retain the old tier boundaries or publish abrupt total-price drops.

| Product | 50 | 100 | 250 | 500 | 1000 |
| --- | --- | --- | --- | --- | --- |
| Heavyweight Tee | 40 | 38 | 35 | 32 | Quote |
| Vintage Cut Tee | 40 | 38 | 35 | 32 | Quote |
| Heavyweight Hoodie | 85 | 80 | 75 | 70 | 65 |
| Canvas Work Jacket | 135 | Unset | Unset | Unset | Unset |
| Track Jacket | 80 | Unset | Unset | Unset | Unset |
| Dad Hat | 20 | 19 | 18 | 17 | 16 |
| Rib Knit Beanie | 18 | 17.50 | 17 | 16.50 | 16 |
| Standard Tote | 25 | 24 | 23 | 22 | Quote |

Proposed treatment of unset jacket quantities is a quote until additional anchors are agreed. Interpolation between accepted anchors remains a planned engineering task; the rule must keep total order price from decreasing when quantity increases. Do not publish unspecified volume prices.

## Cost reconciliation and margin sensitivity

These margins use provisional working costs at quantity 50. They are arithmetic planning scenarios, not validated profit forecasts. They exclude payment fees, proof/production staff time, remakes, support, marketing and any decoration, packing or freight omitted from the quote. No new margin floor is imposed.

| Product | Database cost | Working cost | Target sell price at 50 | Remaining per unit before other costs | Margin before other costs |
| --- | --- | --- | --- | --- | --- |
| Heavyweight Tee | 14 | 16 | 40 | 24 | 60.0% |
| Vintage Cut Tee | 14 | 16 assumed same cost | 40 | 24 | 60.0% |
| Hoodie | 32 | 32 unconfirmed | 85 | 53 | 62.4% |
| Work Jacket | 48 | 48 unconfirmed | 135 | 87 | 64.4% |
| Track Jacket | 28 | 28 unconfirmed | 80 | 52 | 65.0% |
| Dad Hat | 11 | 9 | 20 | 11 | 55.0% |
| Beanie | 10 | 10 | 18 | 8 | 44.4% |
| Tote | 12 | 15 | 25 | 10 | 40.0% |

The beanie and tote have the least room for omitted decoration, freight or staff costs. Model each quantity anchor using its actual vendor quote. Record quote date, validity, currency, quantity, specification version and included costs. Obtain explicit delivered-cost inclusions rather than relying on the term LDP alone; do not add duties/freight twice if the supplier already includes them.

Current database method adders are screen print 4, embroidery 7.50 and rubber applique 6.50 per unit where offered. Current global extra-placement and custom woven-label adders are 2.50 and 2.00. These are implementation values, not verified vendor costs. Simply replacing base price ladders would still add decoration on top of the accepted targets.

## Proposed standard decoration offer

This is a proposal for quoting, not a confirmed customer offer. Use one bounded method per style to make the base offer costable. Quote alternatives separately until validated.

| Products | Proposed included method | Quote must specify |
| --- | --- | --- |
| Both tees, Hoodie, Tote | One screen print at one location | Allowed location, maximum width/height, colour count, setup/screens, ink type, underbase and fabric compatibility |
| Work Jacket, Track Jacket | One embroidered logo at one location | Location, maximum dimensions and stitch count, thread colours, digitizing, backing and lining access |
| Dad Hat, Beanie | One embroidered logo at one location | Cap/cuff location, stitch count, dimensions, thread colours, digitizing, backing and deformation limits |

Factory must confirm each combination. Rubber applique, additional locations, custom woven labels and premium fabrics should remain outside the standard offer until their MOQ, setup, cost, sample and lead time are verified. A garment colour name or Pantone screen target does not establish available fabric stock or an approved dye lot.

## Evidence required to clear a product

Each item needs its own approval record with date, approver, source link or file, and exact version. One supplier confirmation may cover several products only if each specification and quantity is explicit.

- Approved physical sample tied to pattern/spec version, colour/fabric, fit, decoration quality and a retained reference sample.
- Final technical specification: measurements, tolerances, fabric composition/weight/finish, construction, hardware, care/size labels and standard packaging. Existing assumed passport fields and open questions resolved before locking.
- Confirmed supplier identity, responsible contact and actual MoaOS vendor mapping.
- Final delivered unit quote at every offered quantity anchor, with decoration/setup/packaging/freight/duties coverage, destination scope, validity and exclusions.
- Confirmed MOQ by style, colour and decoration, size-mix rules, material availability and method-specific limits.
- Confirmed production plus transit timing from final proof approval, including holiday/capacity exceptions and remote-area surcharges.
- Written supplier remedy for defects, shortages, measurement failures and transit damage, including who pays for replacements and freight.
- Devyn's offer approval after reviewing contribution economics and customer-facing scope.

## Execution order and ownership

| Order | Work | Proposed owner | Done when |
| --- | --- | --- | --- |
| 1 | Locate existing sample approvals and final patterns; resolve specification conflicts | Devyn with production lead | Exact approved base spec and sample evidence exist for each candidate |
| 2 | Obtain final LDP quotes and decoration/packaging/delivery limits using the confirmation packet | Devyn with confirmed suppliers | Every offered configuration has an attributable, valid quote |
| 3 | Build per-order contribution model at each quantity anchor | Engineering with finance and Devyn | All included costs and operating allowances are explicit; Devyn accepts economics |
| 4 | Resolve assumptions and approve passports; create missing accessory specs | Production lead with Devyn | Approved specs contain no assumptions or open questions |
| 5 | Publish verified offer through coordinated product, pricing, seed/fallback and checkout changes | Engineering | Public offer and server charge match; unsupported quantities/options are unavailable or quoted |

Recommended first candidates are Heavyweight Tee and Hoodie because both have substantial measurement records and committed plates. This is an ordering recommendation, not a clearance. Hoodie fabric must be resolved first. Add the other styles individually as their evidence clears.

Until costs and approvals are available, the recommended production launch set is empty. Keep the existing sandbox available for engineering and review. The shared products database is used outside this branch, so any eventual offer restriction must be scoped to Express and must cover API checkout as well as catalog visibility.

## Evidence sources and verification limits

- [Production evidence snapshot](launch-offer-evidence.json), captured October 5, 2026. Contains product metadata and specification summaries; no credentials or customer data.
- `lib/garment-spec.ts`, `lib/garment-spec-store.ts`: passport approval rules.
- `lib/plates-server.ts`, `lib/plates.generated.json`, `app/api/zones/[slug]/route.ts`: plate precedence and legacy zone fallback.
- `lib/pricing.ts`, `lib/seed.ts`: current pricing/adders and seed supplier references.
- June 2026 master sample brief and Best Cover call sheet under `/Users/moabot/projects/moa-brain/moa-context/business-context/`. These are historical planning inputs, not completed quotes or sample approvals.
- Accepted price targets and working costs from the Shop saved context. Devyn's October 5 confirmation supersedes any implication that these are final LDP costs.

No final supplier quotes, actual sample approvals or vendor remedy agreements were verified. This is a local working document; the production catalog and external systems were not edited.
