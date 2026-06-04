# scripts/ — Product-image processing (Python)

Local utilities that normalize product photography into the catalog's recolorable base mockups. Run on a workstation, not in the deployed app.

## Files
- `process-shot.sh` — bash wrapper; activates the venv and runs `process-shot.py`.
- `process-shot.py` — remove background (rembg), trim, and center the garment on a fixed transparent canvas (default 1600×2000). Output = the `base-front.png` / `base-back.png` that live in `public/products/<slug>/`.
- `recolor-mask.py` — generate the fabric-only recolor mask (alpha: opaque = recolorable fabric, transparent = hardware/white panels) so `ProductShot` can tint a single grey base into all colorways.
- `.venv/` — Python env (PIL, rembg, numpy, onnxruntime). Not committed-friendly; recreate with `pip install` if missing.

## How it fits
The catalog renders most SKUs from ONE grey base per view, recolored at runtime by `variant.colorHex` (see `components/ProductShot.tsx`). These scripts produce that base + mask. SKUs with a baked photo instead of a recolor base (e.g. the bi-color trucker) bypass this.

## Specs
See `docs/mockup-asset-spec.md` and `docs/product-shots.md` for canvas dimensions, transparency, and quality requirements.
