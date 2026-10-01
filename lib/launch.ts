// Launch scope for the Express shop. When EXPRESS_CHECKOUT=1 the storefront
// lists only the production-ready launch styles and closes the pages that are not
// part of the Express flow. The products table is shared with the live shop, so
// scope is enforced here in code, never by editing product rows.
import type { CatalogProduct } from "./types";

export const LAUNCH_STYLES = [
  "heavyweight-tee",
  "vintage-cut-tee",
  "heavyweight-hoodie",
  "work-jacket",
  "dad-hat",
  "rib-knit-beanie",
  "standard-tote",
] as const;

// Routes outside the Express flow. Requests redirect to /shop.
export const CLOSED_PREFIXES = ["/p/pr-box", "/samples", "/for/", "/adjust", "/studio-3d", "/studio-decal", "/render-model"];

export function launchMode(): boolean {
  return process.env.EXPRESS_CHECKOUT === "1";
}

export function isLaunchSlug(slug: string): boolean {
  return (LAUNCH_STYLES as readonly string[]).includes(slug);
}

// Packaging stays reachable (it is the add-on layer inside a style order).
export function inLaunchScope(p: Pick<CatalogProduct, "slug" | "category">): boolean {
  if (!launchMode()) return true;
  return p.category === "packaging" || isLaunchSlug(p.slug);
}

// Storefront visibility. Launch styles can stay unpublished in the shared
// products table (so the live shop never lists them) and still show in Express.
export function isVisible(p: Pick<CatalogProduct, "slug" | "category" | "isPublished">): boolean {
  if (launchMode()) return isLaunchSlug(p.slug); // packaging + PR Box return with the PR Box upsell
  return p.isPublished;
}

// Styles waiting on their own 3D model borrow a close block's model, zones and
// calibration so the configurator works end to end. Remove an entry once the
// style has its own GLB + product_zones row.
export const MODEL_STANDIN: Record<string, string> = {
  "vintage-cut-tee": "heavyweight-tee",
};
