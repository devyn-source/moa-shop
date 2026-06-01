import { ProductVisual } from "./ProductVisual";
import type { CatalogProduct, CatalogVariant } from "@/lib/types";

// Renders a garment: grey base recolored live to the colorway → real photo → SVG.
export function ProductShot({
  product,
  variant,
  view = "front"
}: {
  product: CatalogProduct;
  variant?: CatalogVariant;
  view?: "front" | "back";
}) {
  const grey = view === "front" ? product.greyFront : product.greyBack;
  const maskUrl = view === "front" ? product.recolorMaskFront : product.recolorMaskBack;
  const real = view === "front" ? variant?.frontImage : variant?.backImage;
  const alt = `${variant?.colorLabel ?? product.displayName} ${view}`;

  if (grey) {
    const tint = variant?.recolor !== false && variant?.colorHex ? variant.colorHex : null;
    // Confine the tint to the fabric (a mask excludes hardware / white panels);
    // fall back to the garment silhouette when no mask is supplied.
    const maskSrc = maskUrl ?? grey;
    const mask = {
      WebkitMaskImage: `url("${maskSrc}")`,
      maskImage: `url("${maskSrc}")`,
      WebkitMaskSize: "contain",
      maskSize: "contain",
      WebkitMaskRepeat: "no-repeat",
      maskRepeat: "no-repeat",
      WebkitMaskPosition: "center",
      maskPosition: "center"
    } as const;
    return (
      <span className="recolor-shot">
        <img className="recolor-base" src={grey} alt={alt} loading="lazy" />
        {tint ? <span className="recolor-tint" style={{ backgroundColor: tint, ...mask }} /> : null}
        {tint ? <span className="recolor-hi" style={{ backgroundImage: `url("${grey}")`, ...mask }} /> : null}
      </span>
    );
  }

  if (real) {
    return <img className="product-photo" src={real} alt={alt} loading="lazy" />;
  }

  return <ProductVisual type={product.visual} label={variant?.colorLabel ?? product.displayName} swatch={variant?.colorHex} view={view} />;
}
