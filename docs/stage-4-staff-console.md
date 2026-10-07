# Stage 4 staff console, October 7

Status: deployed in sandbox; the full staff and primary-customer screen rehearsal passed October 7 at 20:22 UTC. Other Stage 4 gates remain open.

The signed-in staff workflow is available at https://shop.magnumopus.agency/admin/fulfillment and linked from the operations console. It uses the shop's existing Clerk allowlist and isolated Express service connection. MoaOS main was not changed and no credentials were copied into another project.

The console includes the sandbox order queue, production specifications, proof upload and saved-checkout-mockup review, proof-round preparation, approved factory handoff, acknowledgment, production start, hold/resume, QC evidence, tracking, delivery and attributable history. Cancelled orders cannot proceed. Missing linked projects show an explicit setup error. Every proof still requires the operator's specification check and the customer's subsequent approval.

The shop server resolves the verified operator from Clerk. It rejects customer accounts, cross-origin writes and unsupported actions. The backend independently requires the machine secret, isolated-service profile, sandbox mode and no-send flag. Its command schema has no email-send action. Fulfillment retains optimistic versions and operation IDs; uncertain browser saves require reloading the order before another update. Proof preparation rejects stale rounds and changed specifications. Live fulfillment remains disabled.

## Published versions

- Shop functional release: `d4a67ae`, READY deployment `dpl_Ae5kT3ou9qS9xvGntXTXzcr6SA4a`.
- Backend source: `01606dc` on `express-lane`.
- Isolated service: READY deployment `dpl_CMfoUtTKMjVSKm5jgExyzCZu8WCi`; actual deployed cron list is empty.
- Shop publication used the established atomic `express` and `main` push. Backend publication did not merge Express into MoaOS main.

## Verified

- 171 shop tests and 63 backend tests passed, including staff identity, stale proof, mode isolation, cancelled/unpaid orders, no-send boundaries and uncertain-response handling.
- Both production builds and type checking passed. Later interface refinements passed type checking and production builds again.
- Actual production Google sign-in succeeded for the existing primary operator.
- Staff queue and order details loaded in the signed-in browser. The cancelled-order screen showed fulfillment closed and no proof or milestone mutation controls.
- The restricted service returned 401 for absent and incorrect machine secrets, 200 for the authorized sandbox queue, and 404 for an unrelated outbound route even with the secret.
- Desktop and 390px interface review confirmed Archivo Expanded. The 390px page had no horizontal overflow. A signed-in mobile header overlap was found, repaired and visually rechecked.
- The final operations audit remained in Sandbox simulation: ten checks passed, with the watchdog blocked by the existing overdue EXP-1011 proof incident.

## Completed screen rehearsal, October 7

EXP-1012 completed the actual signed-in Chrome screens with the existing primary operator. Two fresh PNG uploads passed through the native file picker. Round one approved the tote and requested a jacket revision. Round two exposed only the jacket, retained the tote's approval, and saved the customer's jacket approval. Cancellation was unavailable after the first approval. This supersedes the earlier upload and missing-specification blocker.

Handoff initially rejected an incomplete synthetic shipping address without creating a handoff. After the sandbox address was completed, the screens saved preparation, acknowledgment, production start, hold, resume, QC, shipment and delivery. The hold prevented QC advancement. The authenticated service independently returned delivered, fulfillment version 8, no active hold, two closed proof rounds, two specifications and all eight events attributed to the operator. The customer page visibly showed delivered at 1:22 PM PT. All factory names, evidence and tracking were explicitly synthetic. [Screen and persistence evidence](stage-4-screen-acceptance.json).

## Original fixture and prevention

A corrected audit query using the actual `ts` field found the original EXP-1011 project deletion at `2026-10-07T16:30:15.387907+00:00`, through `api/projects/delete`, recorded under Devyn's account. No restoration was performed. The retained order was closed using the application's existing cancellation/refund routine in sandbox mode; the simulated 2,227,500-cent refund succeeded and reconciled. This was server-side maintenance, separate from the browser acceptance evidence.

The narrow MoaOS repair [PR 35](https://github.com/devyn-source/moa-os/pull/35) is merged at `3d97f896b9ff9a774350ca1b51e0094c5b1c5527`, READY production deployment `dpl_GatyoUcVMuLiyh9JBAmV4g4b7v2q`. Four deletion routes now reject records linked to Shop orders before deleting dependent data, including cancelled and delivered orders. A failed lookup returns 503 without deletion. Twelve route regression tests, type checking and the production build passed. This is application-level preflight protection, not a database-level immutability guarantee. The Express branch was not merged into MoaOS main.

The no-send monitor recovered the obsolete proof incident. The October 7 20:32 UTC operations audit returned HTTP 200, all 11 checks passing, zero open incidents and Sandbox simulation.

Backup-operator access, production second-account isolation, email-flow acceptance and production physical/provider-configuration recovery remain separate Stage 4 gates. Physical product and supplier clearance remain deferred. The primary-operator rehearsal does not establish those results.

No email, Slack notification, real charge, real refund or factory release was sent by this implementation or verification.
