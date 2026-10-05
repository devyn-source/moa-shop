# Isolated Stripe processor rehearsal

This opt-in harness exercises the actual shop payment, tax, webhook, cancellation, and refund modules against Stripe's test API. It uses in-memory shop persistence and a simulated MoaOS backend. It does not prove database locking, deployed authentication, browser rendering, live tax classifications, or actual backend integration.

## Isolation

- Requires MOA_STRIPE_REHEARSAL=1 and an sk_test_ secret key.
- Refuses configured Supabase credentials, MoaOS URL, or Resend credentials.
- Blocks application fetch calls outside the simulated backend. Stripe uses its SDK transport.
- Proof, legacy fulfillment, email, and analytics functions throw if invoked.
- Uses synthetic contact details and test payment methods only.
- Does not change live Vercel settings or store test keys in the repository.
- A localhost listener receives signed Stripe CLI test webhooks; no public tunnel or permanent webhook endpoint is created.

## Prerequisites

Use a private environment file outside the repository containing the Stripe test secret. Configure Stripe Tax in that test environment with synthetic California origin and registration fixtures. The harness uses txcd_30011000, Clothing & Footwear, for an apparel test; this does not approve production tax classifications.

A fresh sandbox may have no available balance. Stripe's documented `pm_card_bypassPending` test payment method supplies simulated available funds for refunds. Inspect `pending_reason` before treating a delayed refund as a processing defect.

Install the official Stripe CLI separately. Run from the shop root with:

```sh
MOA_STRIPE_REHEARSAL=1 \
STRIPE_CLI=/absolute/path/to/stripe \
MOA_REHEARSAL_DIR=/private/path/to/results \
node --env-file=/private/path/to/test-credentials.env \
node_modules/vitest/vitest.mjs run --config scripts/stripe-rehearsal/vitest.config.ts
```

The harness reserves 127.0.0.1:3054 and starts a Stripe CLI listener. It writes checkout.json to the private output directory. Complete that hosted TEST Checkout using Stripe test card 4242 4242 4242 4242, a future expiry, and any CVC. Never use a real card. It waits up to 45 minutes for this step. Open http://127.0.0.1:3054/checkout to redirect to the complete Stripe-generated URL. Never shorten the URL or remove its fragment.

After payment it verifies the real signed webhook reaches the application's handler, intentionally receives a backend failure, then replays the canonical session through the actual payment module. It tests duplicate handoff suppression, exact tax/rounding, owner rejection, real test refund creation, backend-refund recovery, lost-response recovery without a second refund, forged webhook rejection, and a Stripe processor decline.

Only a completed passing run writes result.json. Failed or interrupted runs can leave synthetic Stripe test sessions, customers, payments, or refunds. Inspect those test records before restarting; do not treat absent results as a pass. Closing the listener removes its temporary forwarding connection. Test credentials and hosted URLs must not be committed.


## Asynchronous refund processor probes

The companion `refund-states.mjs` uses the documented `pm_card_pendingRefund` and `pm_card_refundFail` test methods. It checks pending-to-succeeded and succeeded-to-failed transitions through the Stripe API without invoking the shop or MoaOS. Run with the same test-key environment, MOA_STRIPE_REHEARSAL=1, and private MOA_REHEARSAL_DIR. A passing processor probe does not establish that the deployed shop receives and reconciles those events.
