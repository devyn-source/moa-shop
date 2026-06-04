# components/ — React components

Storefront, configurator, admin, and studio UI. Client Components where interactive (`"use client"`), Server Components for static display. All styling via brand tokens in `app/globals.css`.

## Product display (storefront)
- `ProductCard.tsx` — catalog grid tile: image-on-cream, name, From-price pill, swatch dots, spec strip (MOQ · Lead · Starts). Hero color = `variants[0]` (per-category, hero-ordered).
- `ProductShot.tsx` — renders a product mock; recolors the grey base by `variant.colorHex` (or shows a baked `frontImage`, e.g. trucker).
- `ProductVisual.tsx` — interactive color-tint overlay. · `ProductGallery.tsx` — multi-view carousel. · `ProductTop.tsx` — PDP header.

## Configurator (the conversion core)
- `PdpConfigurator.tsx` — the PDP flow: color → artwork → decoration → size run → live price. Has `editOrder` mode (seeds from an order for `/adjust/[id]`). Print-resolution QA: `printDpi = artMeta.width / widthIn`; warns <150 DPI, blocks CTA <100.
- `Configurator.tsx` — standalone multi-step variant of the flow. · `DraggableArt.tsx` — artwork placement canvas with zone visualization. · `BrandSelect.tsx` — branded dropdown (State/Country/color).

## Cart & checkout
- `CartProvider.tsx` — cart Context + localStorage. · `CartButton.tsx` — header cart + count. · `CartClear.tsx`.

## Order tracking (customer)
- `OrderTracker.tsx` / `StatusTimeline.tsx` — order status progression (the premium dark stepped tracker).

## Admin tools
- `ProductEditor.tsx`, `NewProductForm.tsx` — product CRUD forms. · `ZoneEditor.tsx` — placement-zone editor. · `AdminOrderActions.tsx` — order status/vendor/revision actions.

## Studio (proofing)
- `StudioPreview.tsx` — multi-variant proof viewer (one decoration across colorways). Reuses `DraggableArt`.

## Layout & nav
- `HomeCatalog.tsx` — homepage grid + filter bar (method/category/MOQ/price/search). · `NavLink.tsx`, `AccountNav.tsx`, `HeaderScroll.tsx`, `ProximityFX.tsx` (cursor-proximity card lift), `PrintButton.tsx`.

## Conventions
- Numeric fallbacks: `??` not `||` where 0 is valid (prices, deposits).
- Keep MOA OS proportions + brand tokens; storefront favors product-experience polish while retaining conversion info.
- Form dialogs follow the premium thesis (warm linen, terracotta accent, borderless inputs); popovers anchor to their trigger, never page-center.
