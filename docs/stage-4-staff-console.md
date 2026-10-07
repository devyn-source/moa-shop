# Stage 4 staff console, October 7

Status: deployed in sandbox; the complete staff screen rehearsal remains open.

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

## Rehearsal interruption

EXP-1011 initially had its linked MoaOS project, two SKU specifications, saved mockups and recorded simulated payment. During the screen rehearsal, its project reference became null and both SKU specification records became unavailable. The read-only staff API independently confirmed this change. A narrowly scoped application audit query returned no matching entries, so the change's source is not established. This session did not delete or restore those records.

The proof upload automation also encountered the Chrome extension's disabled file-URL access. Native picker attempts did not produce a verified upload. Do not count the upload, proof save, customer decision or subsequent milestone screen rehearsal as passed. The existing API/model rehearsals are separate evidence and do not close this screen gate.

Next: coordinate the sandbox cleanup with Devyn, then use a complete sandbox fixture for the actual proof, approval, handoff, hold/resume, QC and tracking screen drill. Preserve current records until that coordination is complete. Fresh file upload remains a separate browser acceptance check. Backup-operator access, production account isolation, email-flow acceptance and provider-level recovery remain other Stage 4 gates.

No email, Slack notification, real charge, real refund or factory release was sent by this implementation or verification.
