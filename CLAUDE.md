# MOA Catalog Claude Handoff

This project is the standalone MVP for the MOA standardized merch catalog. The user has been explicit that it must match **MOA OS branding exactly**, not approximate it.

## Brand Source Of Truth

Use `/Users/MOA/moa-os` as the source of truth for branding.

Key files:

- `/Users/MOA/moa-os/src/app/globals.css`
- `/Users/MOA/moa-os/src/components/sidebar.tsx`
- `/Users/MOA/moa-os/src/components/mobile-header.tsx`
- `/Users/MOA/moa-os/src/components/stat-card.tsx`
- `/Users/MOA/moa-os/src/components/page-header.tsx`

Local copied brand assets live in:

- `public/brand/logos/`
- `public/brand/fonts/`

Current copied assets include the MOA SVG/PNG logo files and Archivo Expanded TTF files.

## Exact Brand Tokens

These values must stay aligned with MOA OS:

```css
--color-cream: #EEEAE3;
--color-cream-dark: #E2DED6;
--color-charcoal: #1E1E1E;
--color-terracotta: #B04731;
--color-terracotta-light: #C45A42;
--color-success: #3D7A4A;
--color-warning: #C4880D;
--color-danger: #B04731;
--color-neutral: #8A8680;
--font-display: "Archivo", sans-serif;
--font-body: -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Helvetica, Arial, sans-serif;
--background: #EEEAE3;
--foreground: #1E1E1E;
--card: #FFFFFF;
--muted: #E2DED6;
--muted-foreground: #8A8680;
--border: #E2DED6;
--input: #E2DED6;
--ring: #B04731;
--radius: 0.5rem;
```

## Visual Rules

- This should feel like MOA OS, not a generic ecommerce landing page.
- Use compact operational UI proportions.
- Page titles should follow MOA OS scale, roughly `1.4rem` to `1.8rem`, uppercase Archivo Expanded.
- Do not use oversized marketing hero type that can collide with cards.
- Cards should be white with cream-dark borders, subtle shadow, and 8-10px radius.
- Labels should be tiny uppercase Archivo Expanded, usually `0.58rem` to `0.65rem`, with positive tracking.
- Primary actions use terracotta background and white text.
- Secondary controls use white background, cream-dark border, and charcoal text.
- Metric/stat cards should follow `StatCard` proportions from MOA OS: compact cards, small uppercase label, body-font numeric value.
- The header lockup currently uses `MOA` as Archivo display text in terracotta, matching MOA OS sidebar/mobile treatment. Avoid using the raw logo SVG directly in tiny nav contexts because the copied SVG has a large 1920x1080 artboard and renders too small unless cropped.

## Current Branding Fix

The previous version used a large marketing-style hero:

- huge Archivo headline
- white hero card
- metric cards beside it

That caused the headline to clip/collide with the metric cards on desktop. It has been replaced with MOA OS page proportions:

- compact page-title scale
- metrics as compact stat cards
- cream canvas
- simple bottom separator instead of a large hero card
- MOA text lockup in the top nav

Keep this direction. Do not reintroduce oversized hero typography.

## Important Files In This Project

- `app/globals.css`: exact brand tokens and global MOA OS styling.
- `app/layout.tsx`: top nav and MOA Catalog naming.
- `app/page.tsx`: public catalog homepage.
- `app/catalog-pdf/page.tsx`: print/save-PDF catalog output.
- `docs/mockup-asset-spec.md`: required mockup asset specs for product/PDF work.

## Naming

The product should be presented as **MOA Catalog** or **Standardized MOA Catalog**.

Avoid reverting to **MOA Shop** in user-facing copy unless discussing the internal project folder/package name.

## Verification

Run these after branding/layout changes:

```bash
npm run typecheck
npm run build
```

Current local dev URL:

```text
http://localhost:3040
```

If port 3040 is occupied by a stale Next process, stop `next dev --port 3040` and restart:

```bash
npm run dev -- --port 3040
```

## Known Notes

- The app is standalone and intentionally isolated from MOA OS code imports.
- MVP persistence is local JSON in `.data/`.
- Supabase, Clerk, Stripe, Resend, and real asset storage are still future integrations.
- Browser extension attributes can trigger harmless React hydration warnings during dev. One observed example was `data-foxclocks-*` injected on `<html>`.
