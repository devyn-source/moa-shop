# Stage 4: operational readiness

Started October 5, 2026. Status: OPEN. This is an engineering and operations gate, not permission to enable payments or release factory orders. Final LDP quotes, physical samples, and supplier commercial terms remain a separate deferred workstream.

## Current closure status, October 5 at 14:48 PT

- **Deployed:** operator console, intake pause control, refund recovery reporting, shared Redis repair, durable job records, independent database watchdog, and proof/hold/shipping incident synchronization.
- **Observed:** production refund and fulfillment jobs succeeded at 14:30 and 14:45 PT; the order monitor succeeded on its 14:45 schedule. The database watchdog runs independently every five minutes. Empty queues and successful runs are recorded separately.
- **Staff:** Devyn primary, Tyler backup. Both have verified accounts in the shop development instance and the separate MoaOS production instance. The shop allowlist now includes both existing MOA email addresses. Staff screen/drill acceptance remains open.
- **Stripe subscriptions:** the existing live endpoint now covers all seven required events. Its URL and signing secret are preserved. A separate TEST endpoint is created but disabled until the isolated rehearsal deployment is ready.
- **Backend:** production shop is pinned to reviewed immutable deployment `moa-byfdhqmyy-devyn-9049s-projects.vercel.app`, commit `ca8e8fa`, rather than the moving branch alias. This is still a preview deployment; retention and long-term production hosting remain open.
- **Identity:** shop production still uses its development Clerk instance. The shop and MoaOS are separate instances in MOA's workspace. No Chase Contemporary application was inspected or changed. Production shop provisioning needs MOA account-level access; existing instance keys cannot provision it. Two verified existing emails establish a continuity plan, not completed production sign-in testing.
- **Tax:** current Drive permit, signed W-9 and insurance were reviewed. Stripe's business identity agrees with Magnum Opus Agency LLC, and CA is the only active Stripe registration. Older permit/Stripe address differs from newer filing address, and Devyn identified a third current operating location. Live tax settings remain unchanged. Factory-direct physical shipment origin and registration/address review still need resolution before tax activation. See Stripe's [head-office guidance](https://docs.stripe.com/tax/set-up).
- **Rehearsal isolation:** a distinct `express_stripe_test` mode now separates test refunds from live and simulated queues. It refuses live keys, Vercel production, unassigned test buyers and a backend without no-send readiness. Backend `stripe_test` payments require sandbox mode, a test session ID, an explicit preview flag and disabled outbound messages. Test orders remain marked as tests.
- **Deployment gate:** automatic approval review rejected copying production-derived database/admin/shared credentials into the preview. That operation did not run, and its generated credential bundle was removed. Separate temporary Supabase branches with synthetic data are proposed instead; approval is pending. Do not retry the rejected credential copy.
- **Still open:** isolated deployed payment/refund/race rehearsal, production Clerk/DNS and real-account isolation, tax-origin/classification review, external availability monitoring and approved notification delivery, operator/backup drills and long-term backend hosting. Stage 4 is not cleared, and live payments remain disabled.

## Reviewed incident alerts, October 5

The operator console now prepares a message addressed only to Devyn, displaying its exact sender, recipient, subject, body and lack of attachments. Sending requires a separate approval action. The server binds that approval to a content hash and reserves the delivery atomically. Concurrent submissions and repeated sends cannot create a second accepted delivery. Provider timeouts and persistence failures retain an uncertain state that blocks automatic resend. Verified Clerk staff may review; sending requires Devyn's verified identity or the existing administrative automation credential. Agent use of that credential still requires Devyn's exact-message approval in conversation.

The service-role-only delivery table is installed with row-level security and no customer access. Draft preparation does not send a message. No alert delivery has been attempted, and provider acceptance is not treated as evidence of inbox delivery. Notifications are not automatic; the separate external availability monitor and notification-delivery drill remain open.

Validation: 137 shop tests and the production build pass, including content changes, concurrent submissions, uncertain outcomes, recovered incidents, staff authorization and cross-origin submission rejection. Signed-in browser review remains outstanding.

## Verified production findings

Read-only checks used freshly downloaded Vercel production configuration and the actual Stripe API. No charges, refunds, messages, vendor orders, or configuration changes were made.

| Area | Evidence on October 5 | Closure requirement |
| --- | --- | --- |
| Payment isolation | EXPRESS_CHECKOUT=1, EXPRESS_SANDBOX=1; configured Stripe key is live | Keep simulation enabled on production. Create a separate Stripe sandbox and isolated rehearsal deployment/data before exercising processor payments. |
| Customer authentication | Clerk secret and publishable keys are test keys | Configure production Clerk, confirm domains and sign-in, and rehearse two-account isolation plus admin allowlist restrictions. Plan account identity continuity before switching. |
| Backend | Express branch-preview alias; authenticated customer lookup returns expected not-found | Choose a stable deployment isolated from unrelated MoaOS work, verify matching secrets and payment mode, staff access, schema compatibility, and rollback. Do not merge OS main by inference. |
| Tax | Tax enable flag and all category codes absent | Review classifications for tee, hoodie, outerwear, headwear, bag; validate registrations and actual tax results in Stripe sandbox. Presence of a code is not tax approval. |
| Rate limiting | Configured Redis PING failed; application currently fails open | Restore or replace the Redis service and prove limits across two app instances. Do not simply fail all uploads and checkout while Redis is broken. |
| Stripe subscriptions | Enabled endpoint at https://moa-shop-amber.vercel.app/api/webhooks/stripe; events only checkout.session.completed, checkout.session.expired, checkout.session.async_payment_failed | Add checkout.session.async_payment_succeeded, refund.created, refund.updated, refund.failed. Verify signatures and actual delivery before activation. Set STRIPE_WEBHOOK_URL to the exact chosen destination for the audit. |
| Refund queue | Table readable, zero rows at audit time | Rehearse cancellation, refund, replay, and backend outage in Stripe sandbox. Empty queue is not proof the recovery job runs. |
| Scheduler | Cron secret present; code schedules recovery every 15 minutes | Observe scheduled runs, add durable last-run/last-success heartbeat and missed-run detection, and verify operator notification delivery after exact-message approval. |
| Staff operations | Stage 3 API rehearsal passed; authenticated staff browser rehearsal remains incomplete | Staff must execute handoff, hold, QC, tracking and incident follow-through using the actual screens in a test order. |

## Local implementation in this change

- `/admin/operations` provides authenticated, read-only configuration and dependency checks, plus unresolved refund and paid-order handoff exceptions. It uses existing brand components and excludes customer contact/address data.
- `/api/admin/express-operations` is also authenticated in the handler. Unknown or blocked checks produce HTTP 503; the response is not cached. Dependency failures are never reported as empty queues. Queue scans are bounded and explicitly report truncation.
- The audit checks exact webhook destination coverage. Alternate aliases must be explicitly configured with STRIPE_WEBHOOK_URL; no credential or private dependency URL is returned.
- Refund recovery filters by the active payment mode, processes oldest attempts first, distinguishes succeeded/pending/failed results, exposes remaining work, and reports item failures as HTTP 503. Processor calls have timeouts and no SDK retries; durable retries retain the original idempotency key and recover existing refunds before considering creation.
- EXPRESS_CHECKOUT_PAUSED=1 rejects new Express checkouts before creating orders or Stripe sessions. Existing paid-event processing and refund recovery remain available in their existing mode. The flag was not enabled in production.
- This does not restore Redis, change provider configuration, set up external monitoring, authorize launch, or implement a support case-management system.

## Validation

114 automated shop tests pass, including queue failures, pending refunds, mode isolation, duplicate-refund recovery, admin authorization, webhook coverage, and checkout-pause recovery. Type checking and the production build pass. A separate read-only run of the new service checks against production succeeded; its sanitized snapshot is [stage-4-audit.json](stage-4-audit.json). Browser control timed out, so the new operator page has not received a visual or signed-in browser review. These Stage 4 changes are local and have not been deployed.

## Stripe test environment progress

October 5: Devyn supplied test credentials. Verified the Stripe test account through read-only API calls. Credentials are stored outside the repository with owner-only access; live Vercel settings were not changed.

The supplied test environment initially had pending tax settings and no webhook endpoints. Synthetic California origin and sales-tax registration fixtures are now active in TEST mode only. These fixtures are not production tax approval. A temporary official Stripe CLI listener receives signed test events on localhost; it does not add a permanent public webhook.

An opt-in harness is available under `scripts/stripe-rehearsal/`. It calls the actual shop payment, tax, webhook and refund functions against the real Stripe test API, using memory-only order storage and a simulated backend. Email, proof, legacy fulfillment and analytics functions are blocked. It refuses production persistence configuration and non-test Stripe keys.

The two-line hosted test checkout passed after Devyn submitted the Stripe test card on October 5. It charged $2,850.01 merchandise plus $245.81 tax, total $3,095.82, in TEST mode. Stripe independently confirmed one successful payment and exactly one successful full $3,095.82 refund. The first handoff webhook intentionally returned HTTP 500 during the injected backend outage; recovery and refund webhooks then passed. Evidence is saved in [stage-4-stripe-checkout-rehearsal.json](stage-4-stripe-checkout-rehearsal.json). Independent asynchronous-refund processor probes passed: pending to succeeded, and succeeded to failed. The new sandbox initially lacked available balance; Stripe's documented bypass-pending test method supplied simulated funds. Evidence is saved in [stage-4-stripe-refund-probes.json](stage-4-stripe-refund-probes.json). The harness verified real signed Stripe CLI delivery, exact tax cents, payment replay, duplicate handoff suppression, owner rejection, backend-refund outage recovery, lost-refund-response recovery, forged-signature rejection, and a processor decline. Shop persistence and the MoaOS backend were simulated. These results do not establish deployed database atomicity, real-account authorization, production webhook delivery, or operational monitoring.

## Stripe rehearsal acceptance matrix

Use Stripe test keys and Stripe test payment methods only. The production simulation flag is not a Stripe sandbox: it bypasses Stripe entirely. A separate rehearsal configuration is required because the current backend calls processor mode `live` even when a Stripe test key is used. Its mail, vendor, and PO paths must be isolated or disabled before testing.

| Scenario | Required evidence |
| --- | --- |
| Successful payment with tax | Cart amount and saved destination agree with Stripe subtotal, tax, and total. All pieces share one checkout. One backend order and one payment record exist. |
| Decline and abandoned checkout | No paid state, production release, customer proof send, or vendor message. Customer can retry safely. |
| Duplicate paid event | Replay the same signed event; no duplicate charge, backend order, or notification. |
| Paid event during backend outage | Shop retains paid status; original event replay completes one handoff when restored; customer is not asked to pay again. |
| Cancellation before approval | Whole checkout cancels, exact full amount including tax refunds, backend remains cancelled. |
| Approval racing cancellation | One outcome wins atomically; no approved production order is refunded through the preapproval path. |
| Refund pending, failed, requires action | UI and operations view retain the actual state; no false success. |
| Refund created but response lost | Retry locates existing refund; no second refund. |
| Refund succeeds, backend unavailable | Refund stays recorded; reconciliation updates the cancelled backend order after recovery. |
| Wrong owner or forged signature | Requests rejected before mutation. Two actual test accounts must be used. |
| Recovery scheduling and outage | Record scheduled run, successful reconciliation, failed-item response, missed run, and operator acknowledgment. |

The independent asynchronous-refund probes and isolated hosted-checkout/application-code rehearsal have passed. The deployed acceptance matrix remains open: actual shop and backend persistence, two signed-in customer accounts, production authentication, production webhook delivery, and scheduled monitoring still require evidence.

## Operating procedure proposed for the pilot

Devyn is the primary operator and Tyler is the backup, assigned by Devyn on October 5. Tyler's staff email and access verification remain outstanding. These are internal response targets, not new customer-facing promises.

Every exception needs a durable case linked to the order/project: category, severity, responsible person, opened time, next action, next review time, evidence links, customer communication draft, financial exposure, resolution, and root cause. Use the existing project/task record for a pilot; a dedicated case UI is not implemented here. Do not keep the only record in email or chat.

- **Paid order missing or duplicate-money concern:** stop further payment attempts for that order; verify Stripe's canonical payment and event record; restore and replay the original handoff. Never ask the customer to pay twice. Escalate immediately to Devyn.
- **Refund problem:** confirm the existing refund ID and processor status, then reconcile. A failed refund needs explicit resolution, not a second blind refund attempt. Keep the customer cancellation cutoff locked.
- **Proof deadline or production delay:** assign an owner, record the cause and supported recovery date, put production on hold where necessary, and prepare a factual customer update. Do not silently change the original promise.
- **QC failure:** hold shipment, attach evidence against the approved specification, obtain the production lead's disposition, then record rework and reinspection before release.
- **Damage, shortage, or defect:** record photos, quantities, delivery date and approved proof/spec references; review against the published policy; choose and authorize a remedy and its payer before creating a remake or refund. Post-approval remedies are not supported by the preapproval cancellation endpoint.
- **Lost shipment:** retain tracking and carrier evidence, assign follow-up, and document the replacement or refund decision. Delivered status is not proof a complaint is resolved.
- **Uncertain email delivery:** inspect the sender mailbox and provider reference before retrying. Do not blindly resend.

Review open exceptions at opening and close of each operating day during the pilot. Urgent money, privacy, or production-release incidents require immediate escalation when detected. A durable monitored alert channel and backup owner must exist before accepting live orders. All outbound messages still require Devyn's separate approval of exact final content, recipients, and attachments.

## Activation and rollback

Close Stage 4 only when the rehearsal matrix, production identity checks, dependency checks, scheduled monitoring, staff-screen rehearsal, and owner/backup assignment have recorded evidence. Product clearance is an additional independent gate.

Before activation: preserve deployed commit, configuration inventory without secrets, schema version, payment mode, and unresolved-queue count. Separate accepting new orders from processing already-paid events and refunds. Do not use EXPRESS_SANDBOX=1 as a universal live incident rollback: current code also blocks real payment handoffs and refunds in that mode. Use EXPRESS_CHECKOUT_PAUSED=1 to stop new checkout creation while preserving paid-event and refund recovery. Already-created Stripe Checkout sessions remain payable; an incident response may also require reviewing and expiring those sessions explicitly.

Roll back application code only after confirming compatibility with saved order/refund state. Never delete payment/refund records or replay a vendor release as a rollback. Reconcile ambiguous money and email results against their providers before retrying.

## Stripe references

- https://docs.stripe.com/testing: use sandbox/test keys; live-mode testing with real payment details is prohibited.
- https://docs.stripe.com/currencies: minimum USD charge is $0.50.
- https://docs.stripe.com/sandboxes/dashboard/manage: create a sandbox within the existing Stripe account.

## Operations infrastructure progress, October 5

- The former Upstash resource is uninstalled. A replacement named `moa-shop-operations` is provisioned on the Free plan with auto-upgrade disabled, connected to production and preview using the `OPS_` namespace. PING and a two-client shared-counter enforcement probe passed. The application now prioritizes these credentials.
- Durable job start, success and failure records now cover refund recovery and fulfillment. Failed batch items and partial fulfillment sweep failures cannot appear as successful jobs.
- An additive service-role-only monitoring schema is installed on the verified shop database. An independent pg_cron watchdog is scheduled every five minutes; monitored jobs stay disabled until deployment. A transactional real-database drill passed missed-run detection, recovery, failure, incident deduplication and restricted-access assertions. Synthetic rows were rolled back.
- The operator console now supports durable acknowledgment, responsibility, next action and review time. Devyn is primary and Tyler backup. This is incident tracking, not proof that operators have completed the drill. No outbound alerts were sent.
- Production Clerk remains blocked on the correct MOA account: the available CLI login belongs to Chase Contemporary and was not used to inspect or alter that account.
- 118 automated tests and the production build pass. The monitoring deployment, observed scheduled execution, notification delivery and staff review remain separate acceptance checks.

Watchdog installation follows [Supabase Cron](https://supabase.com/docs/guides/cron/quickstart). It detects missed Vercel jobs but cannot report a complete Supabase outage by itself; an external availability monitor remains required.
