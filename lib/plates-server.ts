// Finds a style's photoreal plates (public bucket `sku-plates/<slug>/...`).
// PLATE_OVERRIDE="slug=/local/base,slug2=/other" points styles at local plates in dev.
import type { PlateManifest } from "./plates";
import generated from "./plates.generated.json";

export type PlateRef = { base: string; manifest: PlateManifest };

export async function getPlate(slug: string, opts: { preview?: boolean } = {}): Promise<PlateRef | null> {
  // Published 2D plates ship with the site (public/plates, served from the CDN).
  const local = (generated as Record<string, PlateManifest>)[slug];
  if (local) return { base: `/plates/${slug}`, manifest: local }; // real mockups win over any preview link
  void opts;
  const override = (process.env.PLATE_OVERRIDE || "").split(",").map((s) => s.split("=")).find(([k]) => k === slug);
  const origin = process.env.NEXT_PUBLIC_SITE_ORIGIN || "http://localhost:3217";
  const sb = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const base = override ? override[1] : sb ? `${sb}/storage/v1/object/public/sku-plates/${opts.preview ? "_preview/" : ""}${slug}` : "";
  if (!base) return null;
  try {
    const url = base.startsWith("http") ? `${base}/manifest.json` : `${origin}${base}/manifest.json`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return { base, manifest: (await res.json()) as PlateManifest };
  } catch {
    return null;
  }
}

// "Jet Black" -> "jet-black": the plate folder for a colourway.
export const colourSlug = (label?: string) => (label || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
