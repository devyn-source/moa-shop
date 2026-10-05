# Stage 3 sandbox fulfillment

Implemented and deployed October 5, 2026. This workflow rehearses factory handoff through delivery. Live fulfillment mutations and factory email delivery are disabled.

## Workflow

The MoaOS Express project panel now records factory assignment for every piece, freezes the approved specification and proof, and advances through factory acknowledgment, production start, QC, shipment and delivery. Staff can put work on hold and record its resolution. Each transition records the operator, evidence/reference, timestamp and an email draft.

Payment, every piece's proof approval and a complete delivery address are required before handoff. The saved handoff and prior event history cannot be changed by later milestones. Version checks reject overlapping updates; operation IDs make retries safe. QC evidence is required before dispatch. This release supports one complete-order shipment; split shipments, multiple tracking numbers, carrier webhooks and returns remain later work.

The customer account shows the production timeline, holds, estimated ship date, tracking and delivery. Internal factory assignments, operator notes and email drafts are excluded from the customer fulfillment feed.

## Email controls

All Stage 3 previews go only to devyn@magnumopus.agency. Milestones save drafts and never automatically send. The review panel shows exact sender, recipient, subject, body and attachments (none). Sending requires an explicit approval checkbox and the matching content hash. A unique delivery reservation prevents repeated sends. An ambiguous Gmail result is marked unknown and blocks automated retries until the sender mailbox is checked.

Devyn approved the exact shipment preview in this session. Gmail accepted it, the application recorded sent, and a replay returned duplicate without another send. The other seven milestone emails remain drafts. No factories or customers were emailed.

## Verification

- 103 shop tests and 35 backend tests pass.
- Shop local production build and both Vercel production builds passed. Local backend Turbopack was blocked by a process/port restriction; the Webpack fallback exposed an existing unrelated route export issue. The deployed backend build passed with the normal Turbopack configuration.
- Isolated PostgreSQL-compatible integration checks passed for snapshot matching, immutable handoff/history, stale versions, replays, milestone order, QC/tracking requirements, project synchronization and sandbox/cancellation guards.
- Deployed synthetic order EXP-STAGE3-QA-20261005 completed all six stages plus hold/resume. Every action was replayed without duplicate events. All eight emails were drafts before the approved shipment preview was sent.
- Signed-in customer screen was visually verified at delivered status with the full timeline and sandbox tracking. Staff preview URL requires a separate MoaOS sign-in; its controls were compiled and its API workflow was exercised, but authenticated staff browser interaction was not completed.

## Deployment and review

Backend: express-lane commit 1e07347, READY deployment dpl_BTmd6PjXjteq5sHfkHWnpUS1EbHb. MoaOS main was not merged.

Shop: commit db2352a, READY deployment dpl_31Y6mA4qeSxHbEMbChN6Xxp23Dmt at https://shop.magnumopus.agency. Payment sandbox remains enabled.

Backend migration 20261005130000_express_fulfillment.sql was applied successfully in Supabase.

Customer rehearsal: https://shop.magnumopus.agency/orders/express/EXP-STAGE3-QA-20261005

Staff rehearsal: https://moa-os-git-express-lane-devyn-9049s-projects.vercel.app/projects/bbcd213e-a970-497e-8a3b-912afc3c47dd

The fixture contains synthetic approval, payment, address, QC and tracking data and is marked as a test project. Its records do not establish actual factory readiness or physical production. Final LDP costs, physical samples and verified factory contacts remain deferred. Before enabling live release, add validated supplier identities, production authorization and PO/commercial terms, approved samples/costs, and explicit outbound approval for each final message and attachments.
