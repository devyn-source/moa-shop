# docs/ — Architecture & spec documents

Longer-form reference docs (the per-folder CLAUDE.md files are the quick map; these go deep).

- `catalog-fulfillment-architecture.md` — the approval → MoaOS PO → status-sync pipeline in detail: gating modes (`CATALOG_FULFILLMENT_MODE`), the TEST-vendor allowlist, error/ops-alert lanes. Read before touching `lib/catalog-fulfillment.ts`.
- `mockup-asset-spec.md` — required product-shot/mockup asset specs (canvas size, transparency, naming).
- `product-shots.md` — the image-processing pipeline (rembg, recolor masks); pairs with `scripts/`.
- `tech-pack-plan.md` — tech-pack PDF workflow (template, decoration overlay, vendor output via moa-pdf).
- `roadmap.md` — feature roadmap / phase plan.

## Note
Some of these predate recent work. Where a doc conflicts with current code or the root CLAUDE.md (e.g. "future integrations" that are now live, placeholder pricing), trust the code + root doc. Go-to-market planning (business plan, sample brief) lives outside the repo in `~/Desktop/business-context/moa-catalog-*.md`.
