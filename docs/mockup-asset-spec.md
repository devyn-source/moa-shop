# MOA Shop Mockup + Catalog Asset Spec

The MVP already has product records and template slots. Replace the placeholder template URLs with real assets as they are created.

## Required Per Product

For every launch SKU:

- Product hero image: `public/products/{slug}/hero.jpg`
- Product flat front image: `public/products/{slug}/front.png`
- Product flat back image, if applicable: `public/products/{slug}/back.png`
- Variant mockup template PDF: `public/mockups/{slug}-{color}.pdf`
- Optional editable source: keep PSD/AI/Figma source outside public web if proprietary

## Template Rules

Each customer-facing template should show:

- product silhouette
- safe decoration zones
- max artwork dimensions
- front/back/sleeve/panel labels
- accepted artwork formats
- note: "Do not resize garment silhouette"
- note: "Keep artwork inside marked zone"

## Launch Product Slots Already In Data

- `heavyweight-hoodie-black.pdf`
- `heavyweight-hoodie-cream.pdf`
- `heavyweight-tee-black.pdf`
- `heavyweight-tee-white.pdf`
- `fleece-sweatset-heather.pdf`
- `fleece-sweatset-navy.pdf`
- `work-jacket-duck.pdf`
- `work-jacket-black.pdf`
- `standard-tote-natural.pdf`
- `standard-tote-black.pdf`
- `dad-hat-black.pdf`
- `dad-hat-green.pdf`
- `trucker-hat-cream-green.pdf`
- `rib-knit-beanie-black.pdf`
- `rib-knit-beanie-red.pdf`

## Catalog PDF

The print-ready catalog is at:

`/catalog-pdf`

Use the `Print / Save PDF` button in the browser. Once final photography and mockup templates are dropped in, this page becomes the source for a polished sales PDF.
