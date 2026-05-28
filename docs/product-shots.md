# Product Shot Upload Convention

Standard method for adding real product photography to catalog SKUs.

## How to upload (your side)

Drop the image into chat and say which **product**, **color**, and **view** it is. Example:

> "This is the work jacket, black, front."

That's all I need. I run it through the processing pipeline, place the file, and wire it to the SKU.

## Auto-processing (every shot)

Each upload runs through `scripts/process-shot.sh`, which guarantees consistency:

```
scripts/process-shot.sh <input> <output>
```

1. **Removes the background** (rembg / U2Net ML — clean even with soft drop shadows)
2. **Trims** to the garment's bounding box
3. **Centers** it on a fixed **1600×2000 (4:5)** transparent canvas at 88% fill

Result: every product shot is identical dimensions, transparent, so the gallery
frames stay perfectly uniform. Garments float on the cream frame.

- Tooling lives in `scripts/.venv` (Python 3.13, gitignored).
- The U2Net model caches at `~/.u2net/` after the first run.
- Override canvas: `scripts/process-shot.sh in.png out.png --width 1600 --height 2000 --pad 0.88`

### Keeping scale consistent across styles

Default `--pad 0.88` fills the canvas to 88%. Most garments are width-bound, so
slim silhouettes (work jacket) and bulky ones (sherpa) can read at different
visual scales — a wide, spread-sleeve piece looks oversized at the same pad.

Rule of thumb so SKUs sit in proportion next to each other:

- **Tapered apparel / jackets / tees / hoodies:** `--pad 0.88` (default)
- **Bulky / wide spread-sleeve (sherpa, heavy fleece):** `--pad 0.78`
- **Bottoms (wide-leg pants, tall):** `--pad 0.74`
- **Tall bags (tote with handles):** `--pad 0.72` — handles make them height-bound and oversized otherwise
- **Headwear (caps, beanies) / small accessories:** `--pad 0.58` — they're tiny in real life and look jacket-sized at the default

Sanity check after processing — bbox width as % of canvas should land near the
work jacket reference (~78–88% W). Measure with:

```
scripts/.venv/bin/python -c "from PIL import Image;im=Image.open('PATH').convert('RGBA');w,h=im.size;b=im.getbbox();print(f'{(b[2]-b[0])/w:.0%} W')"
```

## Where files live

```
public/products/<product-slug>/<variant-id>-<view>.<ext>
```

- **product-slug** — the SKU's slug (e.g. `work-jacket`, `heavyweight-hoodie`)
- **variant-id** — the color variant id (e.g. `jacket-black`, `hoodie-cream`)
- **view** — `front` or `back`
- **ext** — `png`, `jpg`, or `webp`

Example: `public/products/work-jacket/jacket-black-front.png`

## How it renders

Each variant in `lib/seed.ts` carries optional `frontImage` / `backImage` paths:

```ts
{
  id: "jacket-black",
  colorLabel: "Black",
  frontImage: "/products/work-jacket/jacket-black-front.png"
}
```

- **Product card** (homepage grid): shows `frontImage` of the first photographed variant; falls back to the SVG silhouette.
- **Product detail gallery**: front + back shots per selected color; falls back to SVG per view if a photo is missing.
- **Default selected color**: the first variant that has a photo, so the real shot leads.

## Image guidance

- **Aspect:** portrait or square works. Frame crops to fill (`object-fit: cover`) on cards, fits whole on detail (`contain`).
- **Background:** light/neutral flat-lay or on-white preferred (matches the cream UI).
- **Resolution:** ~1000–1500px on the long edge is plenty for MVP.
- **Naming:** I handle renaming — you just upload + label.

## Variant ids (current SKUs)

| Product | slug | variant ids |
| --- | --- | --- |
| Heavyweight Hoodie | `heavyweight-hoodie` | `hoodie-black`, `hoodie-cream` |
| Heavyweight Tee | `heavyweight-tee` | `tee-black`, `tee-white` |
| Fleece Sweatset | `fleece-sweatset` | `sweatset-heather`, `sweatset-navy` |
| Canvas Work Jacket | `work-jacket` | `jacket-duck`, `jacket-black` |
| Standard Tote | `standard-tote` | `tote-natural`, `tote-black` |
| Dad Hat | `dad-hat` | `dadhat-black`, `dadhat-green` |
| Trucker Hat | `trucker-hat` | `trucker-cream-green` |
| Rib Knit Beanie | `rib-knit-beanie` | `beanie-black`, `beanie-red` |
