import Image from "next/image";
import { ProductVisual } from "./ProductVisual";
import type { CatalogProduct, CatalogVariant } from "@/lib/types";

// Renders a garment: grey base recolored live to the colorway → real photo → SVG.
// The photographic layers go through next/image (resized + modern formats); the
// tint/highlight overlays stay CSS (mask-image can't be optimized) so the visual
// recolor technique is unchanged. `priority` marks the LCP shot (landing hero,
// PDP stage) for eager, high-priority loading — everything else stays lazy.
export function ProductShot({
  product,
  variant,
  view = "front",
  priority = false,
  sizes = "(max-width: 768px) 90vw, 400px"
}: {
  product: CatalogProduct;
  variant?: CatalogVariant;
  view?: "front" | "back";
  priority?: boolean;
  sizes?: string;
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
        {/* Product shots are exported at 1600×2000; CSS (absolute inset-0,
            object-fit contain) drives layout, so the attrs are intrinsic hints. */}
        <Image className="recolor-base" src={grey} alt={alt} width={1600} height={2000} sizes={sizes} priority={priority} />
        {tint ? <span className="recolor-tint" style={{ backgroundColor: tint, ...mask }} /> : null}
        {tint ? <span className="recolor-hi" style={{ backgroundImage: `url("${grey}")`, ...mask }} /> : null}
      </span>
    );
  }

  if (real) {
    return <Image className="product-photo" src={real} alt={alt} width={1600} height={2000} sizes={sizes} priority={priority} />;
  }

  return <ProductVisual type={product.visual} label={variant?.colorLabel ?? product.displayName} swatch={variant?.colorHex} view={view} />;
}
