# Stage 2 readiness

Implemented October 5, 2026. Both database migrations were applied successfully after approval on October 5. The sandbox shop and Express preview backend are deployed and verified. Production flags verified: EXPRESS_CHECKOUT=1 and EXPRESS_SANDBOX=1. No real payments, refunds, vendor messages or factory orders were executed.

## Implemented

- Checkout requires the signed-in account email and validates quantities, sizes, variants and decoration choices. Order success pages enforce ownership.
- Customers can cancel an entire paid checkout before any piece is approved. Database locking serializes cancellation and proof approval; cancelled orders cannot return to production.
- Durable refund records distinguish pending, failed and successful refunds, recover lost processor responses, and reconcile backend accounting through webhook and scheduled retries.
- US Stripe automatic-tax plumbing keeps physical quantities and exact cents, requires reviewed category tax classifications, stores immutable tax totals, and carries tax into the backend invoice. Live checkout remains gated on tax configuration.

## Verification

103 shop tests and 19 backend tests pass. Both production builds pass. Both migrations passed an isolated PostgreSQL-compatible PGlite integration exercise covering ownership, cancellation cutoff, proof/launch guards, atomic checkout refunds, refund references and stale status writes. No live-money test was performed.

## Deployment order

1. Apply backend migration `20261005120000_express_cancellation.sql` to MoaOS and shop migration `20261005121000_express_refunds.sql` to MOA Shop. Both migrations are applied; the SQL editor reported success.
2. Backend deployed on express-lane at `052752a`, deployment `dpl_2uyqEpMraMZeDetyx7gSJ7Q3BBuo`. Its production build passed on Vercel. MoaOS main was not merged.
3. Shop deployed at `9714df5`, deployment `dpl_FPvbynPdSNyp5hCDrRLwH6yuvh4w`, serving https://shop.magnumopus.agency with sandbox flags retained.

## Deployed checks

- Homepage returns 200. Anonymous checkout, cancellation and recovery requests return 401.
- Backend cancellation and refund routes reject missing shared secrets; a nonexistent cancellation returns the expected ownership-safe response. Fixed an omitted middleware route exemption found during this check.
- Shop refund RPC rejects anonymous callers and rejects a nonexistent checkout. Refund table is accessible to the existing server role.
- Authorized recovery ran against a verified empty queue and returned recovered: 0.
- Signed-in customer order page rendered the new cancellation section. Opened its confirmation and selected Keep order; no cancellation was submitted.
- No full deployed purchase-to-refund rehearsal was performed. Automated failure and lifecycle tests cover that behavior; a Stripe test-mode rehearsal remains pending.

## Before live payments

- Review Stripe tax registrations and product category codes; configure STRIPE_TAX_ENABLED and STRIPE_TAX_CODE_<CATEGORY> values. Confirm webhook subscriptions include refund.created, refund.updated and refund.failed.
- Confirm cron authorization and observe reconciliation failures.
- Exercise the complete payment, tax and refund workflow in Stripe test mode before live activation.
- Complete the separate factory workstream: final LDP costs, each style sample with Best Cover, and physical specification approval. Hoodie decision is 480gsm cotton fleece.

These changes close software gaps; they do not establish that the business is ready for live production.
