# MOA Catalog — Build Roadmap

Storefront is live and orders persist. This is the path from "browsable catalog"
to "self-service merch program that runs the factory for us."

- **Live:** https://moa-shop-amber.vercel.app
- **Repo:** https://github.com/devyn-source/moa-shop (auto-deploys on push to `main`)
- **DB:** dedicated Supabase project `moa-shop` (ref `ntppmyydbmwweosuavuw`), isolated from MoaOS
- **Done:** catalog, filters, product detail, configurator, size matrix, product-shot
  pipeline, orders persisted to Supabase

---

## North star: low-touch automated revenue stream

Every decision is judged by one test: **does this remove an MOA touchpoint?**
The goal is a customer can go from browse → paid → in production at the factory
with **zero MOA involvement** on the happy path. MOA only handles exceptions.

The enemy is the **human QA gate** (someone reviewing every mockup). We delete it,
not staff it, using two moves:

1. **Constraints replace placement QA.** The artwork tool only allows valid input
   (art inside decoration zones, locked inch-grid scale, within the method's max
   colors). Placement *can't* be wrong, so no one checks it.
2. **Automated validation replaces file QA.** Reject low-res / RGB / too-many-colors
   / wrong-format at upload, programmatically, with clear guidance. The customer
   approves the auto-generated proof — MOA does not.

Everything after "payment succeeded" is **event-driven and unattended**: create the
MoaOS project → generate the PO → send the tech pack to the vendor. The download
template survives only as a **paid exception lane** for complex jobs (those keep a
human touch and get priced for it).

**Human touchpoints to eliminate (track these to zero):**
- [ ] Mockup placement review → constrained browser tool
- [ ] Art file sanity check → automated upload validation
- [ ] Project setup in MoaOS → auto-created on payment
- [ ] PO creation → auto-generated on payment
- [ ] Tech-pack send to vendor → auto-sent via N8N
- [ ] Order status updates to client → portal reads live state

---

## Cross-cutting: Inch-grid measurement system

The "hold that thought" item. A grid overlay on mockups that lets us measure +
approve sizing from the mockup itself. It's a prerequisite that feeds two phases:
the tech-pack templates (Phase 4) and per-color mockups (Phase 1). Build the grid
spec once, reuse everywhere.

- [ ] Define grid unit (1 inch = N px at a fixed mockup scale)
- [ ] Overlay component (toggleable grid on the gallery / tech-pack tile)
- [ ] Per-SKU measurement points (shoulder, length, width) tied to grid coordinates
- [ ] Approval state on the measurements (ties into Phase 4 tech pack)

---

## Phase 1 — Artwork: constrained placement + auto-validation (the QA-killer)

**Goal:** let the customer position artwork and approve a proof *without MOA review*.
This is the phase that makes the whole thing low-touch. Not a design editor — a
**placement + validation gate** strict enough to trust unattended.

**What it does:**
1. **Upload source art** (their logo/vector). This file always goes to the factory —
   you never generate production art in-browser.
2. **Constrained placement on the inch-grid:** drag/scale art only within the SKU's
   valid decoration zones, at locked inch-grid scale, within the method's max colors.
   Wrong placement is impossible → nothing to review.
3. **Automated file validation at upload:** vector OR min-DPI raster; reject RGB,
   low-res, too-many-colors-for-screen-print, wrong format — instant, with guidance.
4. **Auto-generate the proof + tech-pack spec** (zone, size in inches from the grid,
   method, colors). **Customer approves the proof** — that approval IS the QA.
5. **Live color render:** garment renders in the chosen colorway under the art, so
   one base per style covers every color (kills the "mockup per color" problem too).

**Download template = paid exception lane**, not the default. Designers/complex jobs
get a dieline (safe zones, scale, color mode) and a human touch they're priced for.

- [ ] Inch-grid placement canvas (zones + scale constraints per SKU)
- [ ] Source-art upload → Supabase Storage + automated validation rules
- [ ] Live garment recolor under the art (one base shot per style)
- [ ] Auto-generate proof image + structured tech-pack spec (grid coordinates)
- [ ] Customer proof-approval step (replaces Amanda's review)
- [ ] Exception path → flag to MOA only when validation can't decide
- [ ] Keep download dieline as the paid pro lane

---

## Phase 2 — Stripe + real order flow

**Goal:** replace simulated checkout with real payment + a real order lifecycle.

**Approach:** Stripe Checkout (hosted, lowest-risk). Configurator → create *pending*
order in Supabase → Checkout Session → webhook on success flips to `paid` and
triggers downstream. Offer **ACH** alongside cards for $10–25k orders (card fees
hurt at that size).

**Sub-requirement — artwork upload:** today we only capture the filename. Real flow
must store the file (Supabase Storage bucket on the moa-shop project).

- [ ] Stripe account + keys in Vercel env (test first)
- [ ] Supabase Storage bucket for artwork; real upload from configurator
- [ ] `/api/checkout` creates a Checkout Session (full upfront; ACH enabled)
- [ ] Success / cancel pages
- [ ] `/api/webhooks/stripe` verifies signature → marks order `paid`
- [ ] Order confirmation email (Resend)
- [ ] Order status machine: pending → paid → artwork_qa → … (already modeled)

---

## Phase 3 — Portal integration  ⚠️ DECISION NEEDED

**The question you flagged:** integrate into the existing MoaOS / vendor / client
portals, or build a separate system for the catalog?

**My recommendation: INTEGRATE — do not build a parallel ops system.**
The whole payoff is "data entry done for us": a paid catalog order should
auto-create the project + SKUs in MoaOS so the vendor and client portals (which
already read MoaOS's Supabase) light up automatically. Rebuilding projects/POs/
costing/portals would duplicate everything you've already built.

**Boundary:**
- `moa-shop` Supabase = storefront + transaction record (orders, payments).
- MoaOS Supabase = operations (projects, skus, project_pos, vendors, portals).
- On `paid`, moa-shop writes into MoaOS (via a MoaOS API endpoint or cross-project
  service-role write) to create the project/SKU/company/contact.

- [ ] **Confirm this direction (integrate vs separate) — blocks the rest of Phase 3**
- [ ] Map catalog order → MoaOS schema (projects, skus, companies, contacts)
- [ ] Company/contact matching (existing client vs new) + idempotency (no double-create)
- [ ] Build the write path (prefer a MoaOS `/api/intake/catalog-order` endpoint)
- [ ] Surface the new project in client + vendor portals (should be automatic once written)

---

## Phase 4 — Factory backend (POs + tech packs to vendors)

**Goal:** from a converted order, generate the factory PO and send the tech pack to
the Chinese vendor automatically.

**Good news — mostly reuse, not rebuild.** MoaOS already has a PO system (build/
detail/list + PDF via N8N) and a tech-pack vendor flow with N8N GDrive/Gmail
automation and a China-vendor file proxy. Phase 4 wires the catalog order into that.

- [ ] Map order line → MoaOS PO (auto-fill from catalog SKU + `defaultVendorId`)
- [ ] Generate tech pack PDF (inch-grid measurements from the cross-cutting system)
- [ ] Auto-send to vendor via existing N8N flow (WeChat copy-paste / email / GDrive proxy)
- [ ] PO status back into the order timeline

---

## Suggested sequence

```
Inch-grid system ─► Phase 1 (artwork tool) ─┐
                                            ├─► Phase 3 (auto MoaOS intake) ─► Phase 4 (auto PO + tech pack)
Phase 2 (Stripe) ───────────────────────────┘
```

Inch-grid underpins Phase 1 (placement) and Phase 4 (tech-pack measurements), so it
goes first. Phase 1 (artwork tool) and Phase 2 (Stripe) are otherwise independent.
3 needs a paid order (2) + a spec to hand off (1). 4 needs the project to exist (3).

Each phase is "done" only when it removes its human touchpoint from the North-star
checklist — not just when the feature works.

## Start here tomorrow

1. **Decide Phase 3 direction** (integrate vs separate) — unblocks the back half.
   Recommendation stands: integrate into MoaOS.
2. **Inch-grid spike:** define the grid unit + zone model for one SKU (the tee). It's
   the backbone for the artwork tool and the tech pack — prove it before building on it.
3. **Phase 2 kickoff:** Stripe test keys, artwork-upload storage bucket, stub
   `/api/checkout` + `/api/webhooks/stripe` (pending → paid → fires downstream).
4. **Phase 1 spike:** prototype the constrained placement canvas + automated file
   validation on the tee — this is the QA-killer, derisk it early.
