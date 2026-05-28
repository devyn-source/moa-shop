import { ProductVisual } from "./ProductVisual";
import type { CatalogProduct, CatalogVariant } from "@/lib/types";

// Renders the real product photo when available, else the SVG silhouette.
// Shared by the configurator preview and the catalog PDF so they match the
// product detail gallery and cards.
export function ProductShot({
  product,
  variant,
  view = "front"
}: {
  product: CatalogProduct;
  variant?: CatalogVariant;
  view?: "front" | "back";
}) {
  const src = view === "front" ? variant?.frontImage : variant?.backImage;
  if (src) {
    return (
      <img
        className="product-photo"
        src={src}
        alt={`${variant?.colorLabel ?? product.displayName} ${view}`}
        loading="lazy"
      />
    );
  }
  return (
    <ProductVisual
      type={product.visual}
      label={variant?.colorLabel ?? product.displayName}
      swatch={variant?.colorHex}
      view={view}
    />
  );
}
