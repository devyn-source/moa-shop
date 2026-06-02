# MOA Catalog — Order → Factory Automation Architecture

> Status: **DESIGN (agreed spine, June 1 2026)**. Nothing in here sends to a real
> vendor. The entire pipeline ships behind a `draft_only` switch and routes to a
> TEST vendor until MOA explicitly promotes real factories.

## 0. Prime directive

The catalog turns *browse → pay → produced at the factory* with **zero MOA touch**
on the happy path. But the **only outward, irreversible action in the whole system
is the vendor send.** Everything before it is internal, reversible records. So the
architecture is built around one rule:

> **Create ≠ Send.** We auto-create everything up to a *draft PO sitting in MoaOS*.
> Crossing the line to "email the factory" is a separate, gated step that does not
> run automatically until MOA flips a mode switch — and even then only to
> allow-listed vendors.

## 1. Decisions locked

| Decision | Choice |
|---|---|
| Ops home | A **separate "Catalog" section inside MoaOS** — own tab, own `catalog_*` tables, **same MoaOS Supabase**. Walled off from `projects`/`sales`/`companies`. |
| Vendors | **Shared via foreign key** to the existing `vendors` table (same DB → no sync, no drift). |
| Order source of truth | **Captured in the storefront's own Supabase; pushed to MoaOS on `paid`.** MoaOS = fulfillment truth. |
| PO | **Authored + managed in MoaOS**, **mirrored (status/ref) to the storefront app + API** so the customer tracker is PO-aware. Built on both ends. |
| Finance | **Summary rollup** — catalog revenue/COGS/margin visible to leadership finance; individual orders never enter the CRM pipeline. |
| Vendor send | **Gated.** `draft_only` by default; test vendor; allowlist; dry-run; separate inactive N8N webhook. |

## 2. Topology

```
┌─────────────────────────────┐         ┌──────────────────────────────────────┐
│  STOREFRONT (moa-shop)       │         │  MoaOS  (os.magnumopus.agency)         │
│  Next app · own Supabase     │         │  Next app · MoaOS Supabase             │
│  ───────────────────────     │  push   │  ─────────────────────────────────    │
│  • browse / cart / checkout  │ on paid │  NEW "Catalog" tab + catalog_* tables  │
│  • Stripe payment            │ ───────▶│  • catalog_orders / _items / _pos      │
│  • artwork + proof           │         │  • FK → existing vendors               │
│  • customer /orders tracker  │◀─────── │  • draft PO → [GATE] → vendor send     │
│  • PO status (mirrored)      │  status │  • reuses moa-pdf + N8N Gmail          │
└─────────────────────────────┘  sync   └──────────────────────────────────────┘
        │                                          │
        └──────── shared services (stateless) ─────┘
              moa-pdf (PO + tech-pack render) · N8N Gmail send
```

Two apps, two Supabases. The storefront stays isolated (public repo, commerce only).
MoaOS owns fulfillment. They connect at exactly two seams: **push on paid** and
**status sync back**.

## 3. Data model

**Storefront Supabase (existing `orders` jsonb + new mirror fields):**
- `orders.data.fulfillment = { catalogOrderId, poIds[], poStatus, productionStatus, tracking, pushedAt, lastSyncedAt }`
- This is the storefront's PO-awareness — read by `/orders` + the shop API. Written
  by the push step and the sync-back cron. Storefront never authors a PO.

**MoaOS Supabase — new `catalog_*` namespace (custom orders untouched):**
- `catalog_orders` — id, shop_order_id (idempotency key), order_number, customer
  {name,email,company}, status, totals, artwork refs, created_at.
- `catalog_order_items` — catalog_order_id FK, sku_code, variant, decoration,
  placement spec (zone/size-in/colors), qty, client_unit_cost, **vendor_unit_cost**,
  vendor_id FK, tech_pack_data.
- `catalog_pos` — catalog_order_id FK, **vendor_id FK → vendors**, po_number,
  line items, totals, currency/fx, status (`draft|ready|sent|...`), sent_date,
  pdf_url. Separate from `project_pos` so custom POs stay clean.
- `catalog_order_events` — append-only audit (every state change + every
  would-send/did-send, with payload). The trail.

**Vendor cost is known up front:** the catalog SKU carries `vendorUnitCostUsd` +
`defaultVendorId` (the standardized value prop). Intake writes those into
`catalog_order_items` → the draft PO is complete with no human quoting.

## 4. Lifecycle state machine

```
awaiting_payment ─▶ paid ─▶ artwork_qa ─▶ approved ─▶ READY_TO_SEND ──[GATE]──▶ vendor_notified ─▶ in_production ─▶ shipped ─▶ delivered
                  Stripe   proof tool    auto       │  ⛔ draft PO exists,        │  reuse MoaOS launch
                  webhook  (Phase 1)                │     nothing sent            │  (N8N Gmail + PDF)
                                                    └─ pushed to MoaOS;           └─ status syncs back to
                                                       catalog_order + draft PO      the customer tracker
                                                       created; MOA alerted
```

Left of the GATE: all internal. The GATE is crossed only by (a) an admin clicking
**Release to vendor**, or (b) `mode=auto` + vendor on allowlist.

## 5. Pipeline stages — who does what

| Stage | End | Action |
|---|---|---|
| Capture + pay | Storefront | order + Stripe; on success → `paid`, confirmation email |
| Proof QA | Storefront | constrained placement → auto-validate → customer approves proof (the QA-killer) → `approved` |
| **Push** | Storefront API → MoaOS API | idempotent (`shop_order_id`): create `catalog_order` + items + **draft `catalog_po`** (vendor cost known); write back `fulfillment` refs to the shop order |
| Hold | MoaOS Catalog tab | order at `READY_TO_SEND`; Slack + email "PO ready to release" |
| **Release ⛔** | MoaOS (gated) | render PO + tech-pack PDF (moa-pdf), email vendor (N8N Gmail) → `vendor_notified` |
| Produce / ship | MoaOS Catalog tab | status advances (vendor reply / manual) |
| **Sync back** | Cron (storefront pulls MoaOS) | mirror PO + production + tracking → customer `/orders` tracker |

## 6. Email flows

- **Customer (storefront, N8N Gmail — live):** order confirmation ✓ · proof-approval
  request (Phase 1) · shipped/tracking · exception ("need a better file").
- **Internal / MOA:** new catalog order (Slack + email) · **"PO ready to release"**
  approval request · exception alerts.
- **Vendor (MoaOS, GATED):** PO + tech-pack send — reuses the launch email, but via a
  **separate `catalog-vendor-send` N8N workflow kept INACTIVE** until go-live, and
  routed to the TEST vendor until real factories are promoted.

## 7. Infrastructure & orchestration

- **Orchestration = code, not a black box.** A small state-machine module on the
  storefront drives transitions; a **reconcile cron** (`/api/cron/fulfillment`)
  re-drives any order stuck mid-pipeline. Idempotent on `shop_order_id` (outbox/saga
  pattern — state on the order, cron sweeps, failed steps self-heal).
- **MoaOS** exposes catalog intake + read endpoints, authed with the existing
  `x-moa-internal-secret` header pattern. New `catalog_*` API routes mirror the
  established `/api/*/create` convention.
- **Reuse, don't rebuild:** moa-pdf (PO + tech-pack render) and N8N Gmail are
  stateless services. (Impl note: the existing `generate-po-pdf` N8N flow reads
  `project_pos`/`costing`/`skus`; catalog needs either a catalog-shaped variant or a
  generic render mode — TBD at build.)
- **No new heavy infra.** No Vercel Workflow DevKit / queues yet — status machine +
  cron is simpler and matches the stack. (Upgrade path if true durable
  pause-for-approval is ever wanted.)

## 8. Safety model (5 structural layers)

1. **Create ≠ Send** — intake/PO creation is internal; send is a separate endpoint.
2. **`CATALOG_FULFILLMENT_MODE`** env = `off | dry_run | draft_only | manual_release | auto`. Ships **`draft_only`**.
3. **Test vendor by default** — all catalog POs FK to a `MOA TEST FACTORY` (MOA's own email) until per-SKU promotion to real factories.
4. **Vendor allowlist** — even in `auto`, only allow-listed vendor IDs send; others fall back to `manual_release`.
5. **Dry-run + separate inactive N8N webhook + full audit** — `catalog_order_events` records every would-send payload; the catalog send flow physically cannot touch the live custom-order launch path.

### Safe rollout ladder
`draft_only` (build + test intake/PO, nothing sends) → `dry_run` (inspect would-send payloads) → `manual_release` to TEST vendor (you click, email comes to you) → `manual_release` to one real vendor → `auto` for allow-listed vendors. Each rung is a config change, not a code change.

## 9. Finance rollup

Same DB → a leadership view queries `catalog_orders` (revenue) + `catalog_pos`
(COGS) for a catalog P&L summary alongside MoaOS finance, **without** any catalog
record entering `projects`/`sales`. Catalog vendor bills can later feed the existing
bills/payments flow if desired.

## 10. Open implementation questions

- PO PDF renderer: catalog-shaped variant of the N8N `generate-po-pdf` flow vs a generic render mode.
- Vendor-facing channel: email + PDF + WeChat copy only (recommended v1) vs extending the vendor portal to show catalog POs.
- Proof spec → tech-pack mapping (depends on Phase 1 artwork tool output).
- Status sync mechanism: storefront cron pulls MoaOS (recommended) vs MoaOS pushes to storefront.

## 11. Build order (all behind `draft_only`)

1. MoaOS: `catalog_*` tables + intake API (`/api/catalog/intake`) + read API.
2. Storefront: push-on-paid step + `fulfillment` mirror + reconcile cron.
3. MoaOS: "Catalog" nav tab — dashboard, order list, order detail w/ draft PO.
4. Draft PO generation (catalog cost known) + "Release to vendor" gated control.
5. `dry_run` outbox preview → test-vendor `manual_release` → real vendor → `auto`.
6. Status sync-back to the customer tracker. Finance rollup view.
