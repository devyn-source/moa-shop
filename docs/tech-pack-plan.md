# Catalog Tech Pack — Rework Plan (SHELVED — tackle in detail together)

> Status: **PLANNED, not started.** The current tech pack reuses moa-pdf's
> `/api/tech-pack` with sparse catalog data → mostly empty pages. It's not
> production-usable. This is the plan to make it perfect. Build AFTER the rest of
> the flow is dialed (color selector, size run, real-vendor mapping).

## The core insight

Catalog tech packs are **fundamentally different** from custom-order tech packs:
the **garment is standardized** — MOA already knows its construction, fabric/BOM,
measurements, grading, and flats. The customer only contributes a thin layer:
**artwork, placement, color count, colorway, and the size run.**

So a catalog tech pack = **a fixed per-SKU "garment passport" + the customer's
artwork layer**, composed at order time. We should never hand-author the garment
spec per order — author it ONCE per catalog SKU.

## The two layers

**1. Per-SKU production spec (authored ONCE per catalog product — the gap to build)**
- Size chart: measurement points (chest, length, sleeve, etc.) × every size, with grading + tolerance
- BOM: fabric (composition, weight/oz), trims, thread, hardware, with colors/Pantones
- Construction: seams, collar/cuff/hem, stitching specs
- Labels / care / packaging: main label, care label, size label, hang tag, fold + polybag spec
- Flats: front/back technical flats (line art) for callouts
- Per-zone **inch dimensions** (the inch-grid) so placement size renders in real inches

Stored per product (Supabase `catalog_product_specs` table or extend the product model).

**2. Customer layer (per order — mostly captured already)**
- Artwork file ✓ (validated, 4b)
- Placement: zone + position + transform ✓ (4a) — **needs size-in-inches** (from the inch-grid)
- Ink-color count — **the color mechanism** (customer-declares, next build)
- Colorway ✓ · size run — **needs the size-run threading** (next build)

## Cross-cutting prerequisite: the inch-grid

Define each SKU's canvas at a real scale (1 in = N px) and give every zone real
inch dimensions. This feeds BOTH the placement size-in-inches on the tech pack AND
the measurement callouts. Build the grid spec once, reuse on the proof + tech pack.
(This is the long-standing "hold that thought" item in the roadmap.)

## moa-pdf template rework

The current 7-page template renders empty for catalog. Rework (or a dedicated
`catalog-tech-pack` template) to:
1. **Cover** — SKU, colorway, qty, order #, date, MOA branding
2. **Garment flats** — front/back technical flats with the artwork placement called
   out (zone, position from collar/seam, size in inches)
3. **Artwork spec** — method, ink colors + Pantones, dimensions, max colors, the
   art file reference + the approved proof image
4. **Size chart** — full measurement grid × sizes with grading + tolerance (from SKU spec)
5. **BOM** — fabric/trims/thread with colors/Pantones (from SKU spec)
6. **Construction** — stitch/seam/finish specs (from SKU spec)
7. **Labels / care / packaging** (from SKU spec)

Brand: Archivo, terracotta, NO serif (per MOA report rules).

## Build sequence (when we pick this up)

1. Inch-grid: define unit + per-zone inch dims for one SKU (the tee) — prove it
2. `catalog_product_specs` model + author the tee's full spec (size chart/BOM/construction/labels/flats)
3. Thread customer layer (color count + size run + placement-in-inches) — depends on the two "next" builds
4. Rework the moa-pdf catalog tech-pack template to compose both layers
5. Generate + review against a real factory standard; iterate to perfect
6. Roll the spec authoring out across all catalog SKUs

## Open questions for our detailed session

- Author SKU specs in MoaOS (a "Catalog SKU spec" editor) vs. seed/config vs. a one-time import?
- Pantone capture for screen print — customer-provided, or MOA-assigned at QA?
- Flats: do we have technical line-art flats per SKU, or generate from the base shots?
- How much grading detail do the Chinese factories actually need vs. what's redundant?
