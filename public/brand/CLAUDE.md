# public/brand/ — MOA brand assets

Locally copied MOA brand assets (the app is isolated from MoaOS code, so assets are duplicated here). Source of truth for branding remains `~/moa-os`.

## Contents
- `logos/` — MOA logo files: `moa-logo.png` (primary lockup, used in header + OG card), `moa-logo-full.svg`, `moa-logo-horizontal.png`, `moa-mark.svg`.
- `fonts/` — Archivo Expanded TTF weights (Regular → Black), `@font-face`'d in `app/globals.css` as `--font-display`.

## Usage rules
- Header/nav uses the logo image; historically the raw SVG rendered too small in tiny nav contexts (large 1920×1080 artboard) — use the PNG lockup there.
- OG/social card (`app/opengraph-image.tsx`) uses `moa-logo.png` on cream (#EEEAE3).
- Keep brand tokens aligned with MoaOS (`~/moa-os/src/app/globals.css`); see root CLAUDE.md for the full token set.

## Sibling static folders (not separately documented)
- `public/products/<slug>/` — base mockups (`base-front.png`/`base-back.png`) produced by `scripts/`.
- `public/mockups/` — production mockup templates. · `public/decorations/` — decoration reference art.
