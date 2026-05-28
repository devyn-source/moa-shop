# MOA Catalog — Build Roadmap

Storefront is live and orders persist. This is the path from "browsable catalog"
to "self-service merch program that runs the factory for us."

- **Live:** https://moa-shop-amber.vercel.app
- **Repo:** https://github.com/devyn-source/moa-shop (auto-deploys on push to `main`)
- **DB:** dedicated Supabase project `moa-shop` (ref `ntppmyydbmwweosuavuw`), isolated from MoaOS
- **Done:** catalog, filters, product detail, configurator, size matrix, product-shot
  pipeline, orders persisted to Supabase

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

## Phase 1 — Color selector without a mockup per color

**Goal:** offer many colorways without shooting/building a separate file for every
color of every style.

**Recommended approach:** stop thinking "one mockup per color."
1. **Product shots:** keep ONE neutral base shot per style; generate colorways
   offline by recoloring (preserve luminance/shadows, swap hue+chroma). Shoot only
   hero colors for real. Add a `recolor` mode to `scripts/process-shot.py`.
2. **Tech-pack template:** color is irrelevant to the design file — **one template
   per style**, color is just a spec note. This is where the "separate mockup per
   color" problem mostly disappears.
3. **Live swatch preview (optional):** CSS `mix-blend-mode: multiply` tint over the
   base for instant in-browser colorway previews.

- [ ] Decide base-shot standard (neutral garment, good shadow detail)
- [ ] `process-shot.py --recolor <hex>` (LAB lightness preserved)
- [ ] Colorway hex map per style in seed
- [ ] Generate + wire `variant.frontImage`/`backImage` from generated files
- [ ] One tech-pack template per style (not per color)

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
Phase 1 (color)  ─┐
                  ├─► Phase 3 (portal integration) ─► Phase 4 (factory)
Phase 2 (Stripe) ─┘
Inch-grid system ──────────────► feeds Phase 1 templates + Phase 4 tech packs
```

Phases 1 and 2 are independent — can run in parallel. 3 needs a paid order (2).
4 needs the project to exist (3).

## Start here tomorrow

1. **Decide Phase 3 direction** (integrate vs separate) — unblocks the back half.
2. **Phase 2 kickoff:** create Stripe test keys, add artwork-upload storage bucket,
   stub `/api/checkout` + `/api/webhooks/stripe`.
3. **Phase 1 spike:** prototype `process-shot.py --recolor` on one base shot to prove
   the "one base, many colors" approach before committing to it.
