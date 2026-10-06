# Stage 4: operational readiness

Started October 5, 2026. Status: OPEN. This is an engineering and operations gate, not permission to enable payments or release factory orders. Final LDP quotes, physical samples, and supplier commercial terms remain a separate deferred workstream.

## Current checkpoint, October 6

Devyn confirmed every launch order ships from China, directly from the overseas factory. Exact physical dispatch addresses are not yet confirmed. The Zhangjiagang invoice address remains evidence of a supplier address only. China origin does not resolve the head-office/registration address mismatch. Live Stripe Tax remains unchanged.

Devyn asked to defer other-user acceptance until the system is ready. Tyler sign-in, production two-account isolation and backup screen drills remain explicit deferred gates, rather than blocking continued engineering work. No invitations or factory messages were sent.

The dedicated Express service is now deployed to Vercel production in `moa-shop-express-service`, separate from MoaOS main. Devyn explicitly approved its narrow production credential setup and previews-only Vercel protection. Its machine routes require the Express secret; unrelated pages, outbound jobs and MCP routes return 404. Public health returns only availability. Production deployment `dpl_3CdeiTwkNXP9k9ncYMNc382C4PBn` has an independently verified empty cron list and enforces sandbox/no-send at build time. Monitoring reads match the previous backend and the existing sandbox fulfillment record is readable. Shop production commit `c30c3ad`, READY deployment `dpl_6yAMZoML5wbFP9vP9NP7Jm8rCieg`, now uses its stable production alias. The old preview bypass credential was removed from production configuration. The post-cutover operations audit verifies the restricted production target, matching sandbox mode, Redis and empty payment/refund queues. Tax and the existing operator incident remain blocked. Evidence: [stage-4-service-hosting.json](stage-4-service-hosting.json).

The first service package unexpectedly registered default MoaOS cron paths despite the alternate-config CLI flag. The API boundary rejected those paths. The corrected clean package explicitly replaces the root configuration, and the final deployed cron list is empty. The deployment procedure records this requirement.

A credential-free availability script checks the storefront, sign-in and a dependency health endpoint. The GitHub Actions workflow at `.github/workflows/availability.yml` defines a best-effort 15-minute schedule. Devyn approved workflow access and completed GitHub verification; the refreshed CLI scope is confirmed. The installed workflow passed its first GitHub-hosted manual dispatch on October 6 at 15:50 UTC: all three checks returned HTTP 200 and healthy=true. [Run 37490866839](https://github.com/devyn-source/moa-shop/actions/runs/37490866839). A scheduled-trigger execution has not yet been observed. A manual external run after deployment returned HTTP 200 for all three targets, including the dependency health endpoint. The endpoint checks both databases and authenticated backend mode. Results are stored in a job summary and 30-day artifact. Outages are recorded without sending notifications; successful workflow completion is not a healthy-site assertion. Alert delivery is still an open gate requiring exact-message approval.

Archivo Expanded is the only front-facing MOA typeface. The actual local Expanded files now serve global body and display text, embedded Clerk forms, verification/account defaults, welcome content and standalone approval pages. Normal-width Archivo overrides were removed. Legacy shop HTML email templates also request Expanded with hosted font declarations; email clients that block web fonts control fallback rendering. No message was sent. The project brand guide records this requirement. Desktop and 390px signup were visually reviewed locally; a clipped email placeholder was shortened. Production CSS and Clerk appearance were checked, and the served Regular/Bold font files match the local Expanded assets byte for byte. The approved compact composition and palette are preserved.

Validation: the prior deployment passed 156 shop tests, type checking and production build. The Slack update passes 158 tests, type checking and the production build. Backend has 51 passing tests and a successful production build. The backend now has a versioned empty-schema recovery bootstrap and a credential-free PostgreSQL replay harness on `express-lane` at `cfe994d`. Its ten database acceptance checks pass. Historical production migration metadata remains unchanged. Operator incident acknowledgment and Slack alert delivery remain unpassed drills. Devyn selected Slack instead of email for operator alerts; the earlier email draft remains unsent.

## Recovery and monitoring hardening, October 6

Backend `cfe994d` adds `supabase/bootstrap/20261005_express_recovery.sql`, a pinned schema-only bootstrap and documented future-change procedure. A local PGlite PostgreSQL runner creates a fresh in-memory database, restores 87 tables/10 views/18 functions with zero application rows, and rejects replay onto an existing schema. The isolated service access profile denies anonymous/customer table and function access. Ten checks pass, including owner/payment rejection, cancellation/proof locks, refund amount/reference consistency, approved-piece cancellation refusal and immutable fulfillment history. It reads no provider credentials and makes no network calls. Evidence: [stage-4-backend-recovery.json](stage-4-backend-recovery.json). This is a new-database recovery path, not a change to production or a rewrite of its migration metadata. Hosted backups, storage and provider configuration remain separate recovery requirements.

The external observation script now has eight independent failure tests: HTTP errors, malformed/unhealthy JSON, unexpected pages/content types, network/redirect errors and timeout. It preserves the received HTTP status when body parsing fails, checks HTML content type, and refuses redirects. These checks run before every GitHub observation. GitHub reports the workflow active on the non-fork repository's default `main` branch; its first scheduled trigger is still unobserved. No messages are sent by the observer.

GitHub reported GHSA-vfj7-8cjw-p6xm for `braces` through the backend's shadcn CLI dependency. The dependency is used only by build tooling in this source (shadcn CSS import); no affected glob packages appear in the completed backend server trace files. There is no patched release in the advisory at this checkpoint. The advisory remains open for dependency maintenance; no unrelated MoaOS code or dependencies were changed.

The Slack-only review implementation is deployed at shop `dcc1796`, READY `dpl_BBbmspe5MqkrHXQkgBL21osYcLRJ`. Private `moa-shop` membership was independently verified as Devyn plus the existing Claude-CLI bot. Production prepared the exact sandbox draft successfully and returned healthy afterward. No Slack alert or email was sent; the exact-message approval remains pending.

## Isolated deployed rehearsal, October 5 evening

Devyn approved the temporary databases. Created schema-only branches `ifepwvgnlfkujnlzapge` (shop) and `eebmgvlfrlduykjhbnsb` (backend), plus separate Vercel projects `moa-stage4-shop-20261005` and `moa-stage4-backend-20261005`. These projects use new database credentials, fresh shared/admin/cron secrets, a new accountless Clerk development instance and Stripe TEST credentials. No production credential bundle was copied. No mail-provider or factory credentials were configured; backend no-send readiness was verified over HTTP.

The initial branch restores revealed incomplete migration history. The backend had no application baseline, and the shop was missing catalog/shared-design/analytics baselines. Both isolated schemas were restored from inspected schema-only exports, excluding records and ownership grants. Empty order, contact, project and payment counts were verified before fixtures. The shop now includes the missing baseline migration before account_features; all shop migrations replayed successfully into a separate empty schema, producing 14 tables, with the probe rolled back. The backend's full migration-history repair remains separate from the successful schema-snapshot restore.

Two verified synthetic Clerk users and actual development sessions exercised the deployed checkout. Anonymous checkout returned 401; a second user submitting the first user's email returned 400. The first user's two-item checkout persisted in the isolated shop database and created a hosted Stripe TEST session: subtotal 625100 cents, tax 53915 cents, total 679015 cents. Its synthetic destination is not production tax-origin approval.

A second real TEST checkout was expired through Stripe. Its signed expiry webhook closed both unpaid order lines without backend handoff. A forged webhook signature returned 400. Evidence is in `docs/stage-4-isolated-rehearsal.json`.

Devyn completed the hosted TEST decline and successful payment. Stripe recorded both events. The paid webhook exposed a real persistence defect: PostgreSQL JSONB reordered tax snapshot fields, so serialization equality rejected unchanged tax values. `lib/store.ts` now compares values independently of key order. Three regression tests cover initial persistence, replay, changed amounts and compare-and-swap conflict behavior.

After deploying that fix to the isolated shop, both lines retained paid status and exact tax during the injected backend outage. Restoring access and replaying the canonical signed event produced exactly one backend order and one payment record. Three concurrent replays returned 200 without duplication. Two actual synthetic Clerk sessions proved wrong-owner cancellation and approval rejection (404), backend view isolation, and customer portal isolation. Next.js streamed the unauthorized portal's not-found boundary with HTTP 200; its order details were absent. This is recorded explicitly rather than presented as a transport 404.

The full 679015-cent TEST payment was refunded, including 53915 cents tax. A temporary database trigger rejected successful refund persistence after Stripe accepted it, leaving the durable queue at requested with no saved refund ID. Retry recovered that same processor refund. A second fault blocked backend reconciliation while the shop retained the succeeded refund; the actual recovery endpoint reconciled one item after permission restoration. Concurrent cancellation retries still left exactly one refund. A late paid event left both lines refunded and the backend cancelled.

Three separate synthetic sandbox orders exercised approval/cancellation races in real database transactions. Two cancellations won and one approval won; no order reached both outcomes. A fourth synthetic order completed proof approval, immutable handoff preparation, acknowledgment, production, hold, resume, QC, shipment and delivery. Approval gates, stale versions, duplicate operation IDs, post-approval cancellation and hold restrictions passed. Eight milestones were recorded with zero mail-delivery rows. These lifecycle fixtures did not create additional Stripe payments or real manufacturing instructions.

Evidence is saved in [stage-4-isolated-rehearsal.json](stage-4-isolated-rehearsal.json). The final test deployment was `dpl_9BTMrnkTwxcqaB28VWxToE82Xvte`. Private runner scripts and synthetic raw evidence remain outside the repository under `/Users/moabot/.config/moa-stage4/`. Cleanup is complete: the TEST webhook is disabled, both temporary Supabase databases and Vercel projects are deleted, and both synthetic Clerk users are deleted. The unclaimed temporary Clerk development instance remains without test users. Neither production payment mode nor production shop Clerk was changed.

149 shop tests, type checking, and the local and isolated deployment builds pass. The backend's 43 tests and isolated deployment build passed. Source hardening also separates authenticated machine endpoints from Clerk availability and requires verified primary emails for customer history, portal and proof decisions. Published to shop production at commit `23d0ce5`, READY deployment `moa-shop-rjo2wua93-devyn-9049s-projects.vercel.app`. The authenticated post-deployment audit confirms Sandbox simulation, working Redis and backend connectivity, and no unresolved payment/refund queues. Backend commit `dcf04bc` is pushed only to `express-lane`; MoaOS main is untouched and the production shop retains its reviewed immutable backend target.

## Latest production follow-up, October 5 evening

Signed into Clerk through Devyn's MOA Google account and verified the shop application `app_3EjVOKNpmFJAB3bCcohfPczbXcf` (display name Magnum Opus Supply), with the existing development instance and Devyn/Tyler accounts. The MOA internal, vendor and client portals remain separate applications. Browser and CLI access now use Devyn's MOA account. The earlier unrelated CLI session was replaced; no Chase Contemporary application was inspected or changed. Devyn explicitly approved production-instance creation after automatic review requested that approval. Created production instance `ins_3KIslZNqnxb2ZRQEaGH1T4SYb56` for `shop.magnumopus.agency`, choosing the separate subdomain configuration so its Frontend API is `clerk.shop.magnumopus.agency`. All five CNAME records were saved in Squarespace with a four-hour TTL and verified through public DNS and the Clerk dashboard. Exact records are saved in [clerk-production-dns.zone](clerk-production-dns.zone). Clerk reports Frontend API verified, account portal verified and email 3/3 verified. Both SSL certificates are issued and independent TLS verification succeeds, with expiration January 4, 2027. Devyn explicitly approved email and Google for launch; Apple and X are now disabled in production. Email requires a verified code. Google is enabled with the dedicated production client ID and secret configured. Google Cloud access is confirmed. The existing shared `clerk` OAuth client serves the other MOA portals. Devyn created the separate `MOA Catalog Production` web client in project `moa-automation`, with only `https://shop.magnumopus.agency` as origin and `https://clerk.shop.magnumopus.agency/v1/oauth_callback` as callback. Its downloaded credential JSON was moved to the restricted private configuration directory, and the validated Google credential patch was applied to production Clerk. The refreshed dashboard shows Google Enabled; the production account portal visibly offers Google and email only. The project's Google OAuth audience is External and In production; shop Clerk requests only openid, email and profile. Production paths now point to `/sign-in`, `/sign-up` and `/` on the shop. Production keys are saved privately with restricted permissions. Devyn then completed Google sign-in: a read-only lookup of the exact production instance confirms his MOA primary email is verified through Google and has a successful sign-in timestamp. Customer orders, saved designs and staff authorization resolve verified email rather than development user IDs. The production allowlist retains Devyn and Tyler. Both production Vercel Clerk keys are now set to this instance, with the previous development keys saved privately for rollback. Deployment `dpl_9S4epou45DSawAFmpMR8Gz9itBZT` at commit `117e495` is READY and serves the public shop. Native Chrome acceptance confirms Devyn can open existing orders and the staff operations console with his production account. A clean signed-out session shows Google and email signup without a development-mode badge; anonymous staff-console access redirects to sign-in with its return destination preserved. Tyler sign-in, production two-account isolation, and email verification/recovery acceptance remain open. EXPRESS_SANDBOX remains 1; no payment or factory activation is included.

Devyn settled the $25 Clerk invoice dated October 4, 2026. A refreshed Payment & invoices page verifies Paid, and the outstanding-invoice warning is gone. No agent payment or billing change was performed.

Devyn reconfirmed direct shipment from the overseas factory to each customer. A Los Angeles office or registration address alone therefore does not resolve physical shipment origin. Factory dispatch address(es), category classification and registration/address reconciliation remain open; live Stripe Tax settings are unchanged. See [Stripe head-office setup](https://docs.stripe.com/tax/set-up) and [ship-from calculation input](https://docs.stripe.com/api/tax/calculations/create).

The post-deployment monitor correctly surfaces an overdue proof on sandbox order EXP-1010. It remains an open operator-review item, not a passed drill or a resolved incident. No alert was sent.

## Remaining Stage 4 closure work

The deployed financial recovery and synthetic fulfillment rehearsal is complete. Stage 4 remains OPEN for Tyler sign-in, production account isolation and email-flow acceptance, production tax origin and category review, Devyn/Tyler screen drills, scheduled external availability observations and approved alert delivery, hosted recovery/data-backup verification and reconciliation of the backend migration history. The new pinned schema bootstrap passes empty replay and application safety checks; it does not reconstruct historical migration metadata or restore customer records/storage.

Production stays in simulation. Samples, final LDP costs and supplier commercial readiness remain the separate deferred workstream.

## Historical checkpoint, October 5 at 14:48 PT

- **Deployed:** operator console, intake pause control, refund recovery reporting, shared Redis repair, durable job records, independent database watchdog, and proof/hold/shipping incident synchronization.
- **Observed:** production refund and fulfillment jobs succeeded at 14:30 and 14:45 PT; the order monitor succeeded on its 14:45 schedule. The database watchdog runs independently every five minutes. Empty queues and successful runs are recorded separately.
- **Staff:** Devyn primary, Tyler backup. Both have verified accounts in the shop development instance and the separate MoaOS production instance. The shop allowlist now includes both existing MOA email addresses. Staff screen/drill acceptance remains open.
- **Stripe subscriptions:** the existing live endpoint now covers all seven required events. Its URL and signing secret are preserved. A separate TEST endpoint is created but disabled until the isolated rehearsal deployment is ready.
- **Backend:** production shop is pinned to reviewed immutable deployment `moa-byfdhqmyy-devyn-9049s-projects.vercel.app`, commit `ca8e8fa`, rather than the moving branch alias. This is still a preview deployment; retention and long-term production hosting remain open.
- **Identity:** shop production still uses its development Clerk instance. The shop and MoaOS are separate instances in MOA's workspace. No Chase Contemporary application was inspected or changed. The production instance has now been provisioned with MOA account-level access and its five DNS records are verified, as recorded above. Two verified existing emails establish a continuity plan, not completed production sign-in testing.
- **Tax:** current Drive permit, signed W-9 and insurance were reviewed. Stripe's business identity agrees with Magnum Opus Agency LLC, and CA is the only active Stripe registration. Older permit/Stripe address differs from newer filing address, and Devyn identified a third current operating location. Live tax settings remain unchanged. Factory-direct physical shipment origin and registration/address review still need resolution before tax activation. See Stripe's [head-office guidance](https://docs.stripe.com/tax/set-up).
- **Rehearsal isolation:** a distinct `express_stripe_test` mode now separates test refunds from live and simulated queues. It refuses live keys, Vercel production, unassigned test buyers and a backend without no-send readiness. Backend `stripe_test` payments require sandbox mode, a test session ID, an explicit preview flag and disabled outbound messages. Test orders remain marked as tests.
- **Deployment gate:** automatic approval review rejected copying production-derived database/admin/shared credentials into the preview. That operation did not run, and its generated credential bundle was removed. Devyn subsequently approved separate temporary Supabase branches with synthetic data; the completed rehearsal and cleanup are recorded above. Do not retry the rejected credential copy.
- **Still open:** isolated deployed payment/refund/race rehearsal, production Clerk/DNS and real-account isolation, tax-origin/classification review, external availability monitoring and approved notification delivery, operator/backup drills and long-term backend hosting. Stage 4 is not cleared, and live payments remain disabled.

## Slack operator alerts, October 6

Devyn explicitly selected Slack instead of email. The operator review flow now prepares a Slack-only message, showing the workspace, bot user, destination, full text and no attachments. The content hash binds those fields. Before sending, Slack auth.test must confirm the configured workspace and bot identity. Atomic reservation prevents concurrent sends; uncertain delivery or persistence blocks automatic retry. There is no email fallback, and the prior email draft remains unsent. Configuration requires an explicit destination; there is no default public channel. Devyn selected a new channel named MOA shop. Private `moa-shop` (`C0C793D39K6`) was created in the Magnum Opus workspace, with Devyn as its only person. Other-user invitations remain deferred. The existing Claude-CLI bot is now a channel member. Production-only Slack configuration is stored on the shop project; the Express backend still has no outbound credentials. Exact-message delivery approval remains pending. The existing MOA Slack bot and Devyn's Slack user were verified using read-only API calls.

The monitor observes availability without sending messages. Slack delivery remains a separate reviewed action. Reference: [Slack chat.postMessage](https://docs.slack.dev/reference/methods/chat.postMessage/).

## Historical reviewed email alerts, October 5

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
- Superseded by the production Clerk progress above: MOA browser and CLI access are now confirmed, the production instance is created, and all five DNS records are verified. Production provider setup and sign-in acceptance remain open.
- 118 automated tests and the production build pass. The monitoring deployment, observed scheduled execution, notification delivery and staff review remain separate acceptance checks.

Watchdog installation follows [Supabase Cron](https://supabase.com/docs/guides/cron/quickstart). It detects missed Vercel jobs but cannot report a complete Supabase outage by itself; an external availability monitor remains required.

## Customer account design, October 5 evening

- Sign-in and sign-up share a compact MOA layout with Archivo typography, cream, charcoal and terracotta, a single studio image on desktop, and a focused form on mobile. Promotional paragraphs and feature lists were removed after Devyn's design feedback.
- Clerk verification and recovery screens inherit the shared appearance. New standalone sign-ups have a short authenticated welcome page; explicit checkout return destinations retain priority.
- Local browser checks passed at 390px: no truncated provider labels, required-field validation, sign-in navigation, and checkout-to-sign-up redirect preservation (including the sign-in link). Typecheck, all 149 tests and production build passed.
- These checks cover the interface, not completed production sign-up or Google account acceptance. Production Clerk activation remains a separate open gate. Payment and fulfillment sandbox settings are unchanged.

## Supplier-origin evidence

Devyn reconfirmed direct overseas-factory delivery. Drive invoice BEST20260403-11, dated April 3, 2026, identifies BEST COVER TRADING (HONGKONG) CO., LIMITED and prints No.782, Gangchengdadao, Zhangjiagang City, Jiangsu, China (invoice spelling: ZHANGJIAGNG). [Source invoice](https://drive.google.com/file/d/1KayoVOmnmBySJKwcLGZocyzyzgxplxmb/view). This is supplier-address evidence, not confirmation that every launch style dispatches from that address. No invoice bank details are reproduced and no factory was contacted.

## Prepared tax classification review

Draft candidates from [Stripe's product tax codes](https://docs.stripe.com/tax/tax-codes), not applied to production:

| Catalog category | Candidate | Review needed |
| --- | --- | --- |
| Tee, hoodie, outerwear | `txcd_30011000`, Clothing & Footwear | Confirm each launch product fits ordinary apparel treatment. |
| Headwear | `txcd_30060006`, Hats | Confirm dad hat and beanie classification. |
| Bag | `txcd_30060001`, Purses and Handbags | Confirm the launch tote fits this definition before choosing it. |

Final setup still needs the actual China dispatch address for each supplier, reconciliation of the business/registration addresses, and confirmed sales-tax registrations. A supplier invoice address is not dispatch confirmation. No factory was contacted and no tax settings were changed.
