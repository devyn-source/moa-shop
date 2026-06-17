// Per-SKU production assets stored in Supabase Storage (no DB table — the bucket
// folder IS the record). Two kinds:
//   • CAD pattern files (DXF/AI/PLT) → PRIVATE `sku-patterns/<slug>/<file>`.
//     MOA + vendor only; surfaced to vendors as signed URLs in the PO email.
//   • 3D model (GLB) → PUBLIC `sku-models/<slug>.glb`. Rendered on the PDP.
import { getSupabase } from "./supabase";

export const PATTERN_BUCKET = "sku-patterns";
export const MODEL_BUCKET = "sku-models";

// Long-lived signed URLs: a pattern link rides the MoaOS PO email through the
// whole production cycle, so it must outlast the order.
const PATTERN_SIGNED_TTL = 60 * 60 * 24 * 365; // 1 year

export type PatternFormat = "dxf" | "ai" | "plt" | "file";

export type PatternFile = {
  path: string; // bucket-relative: <slug>/<filename>
  filename: string; // display name
  format: PatternFormat;
  bytes: number;
  uploadedAt: string | null;
};

export type SignedPatternFile = PatternFile & { url: string };

export function patternFormat(filename: string): PatternFormat {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  return ext === "dxf" || ext === "ai" || ext === "plt" ? ext : "file";
}

// List the CAD pattern files stored for a SKU. Supabase prepends a hidden
// `.emptyFolderPlaceholder` to new folders — filter it out.
export async function listPatternFiles(slug: string): Promise<PatternFile[]> {
  const sb = getSupabase();
  const { data, error } = await sb.storage
    .from(PATTERN_BUCKET)
    .list(slug, { limit: 200, sortBy: { column: "created_at", order: "desc" } });
  if (error || !data) return [];
  return data
    .filter((o) => o.name && !o.name.startsWith("."))
    .map((o) => ({
      path: `${slug}/${o.name}`,
      filename: o.name,
      format: patternFormat(o.name),
      bytes: (o.metadata?.size as number | undefined) ?? 0,
      uploadedAt: o.created_at ?? null,
    }));
}

export async function signPatternFile(path: string, ttl = PATTERN_SIGNED_TTL): Promise<string | null> {
  const sb = getSupabase();
  const { data } = await sb.storage.from(PATTERN_BUCKET).createSignedUrl(path, ttl);
  return data?.signedUrl ?? null;
}

// Pattern files with a fresh signed URL each. Used by the admin UI (download
// links) and the MoaOS intake payload (vendor PO email references).
export async function listPatternFilesSigned(slug: string): Promise<SignedPatternFile[]> {
  const files = await listPatternFiles(slug);
  const signed = await Promise.all(
    files.map(async (f) => {
      const url = await signPatternFile(f.path);
      return url ? { ...f, url } : null;
    })
  );
  return signed.filter((f): f is SignedPatternFile => f !== null);
}

// Download a SKU's primary DXF as text. DXF apparel files are GB2312-encoded
// (Chinese piece labels), so decode as latin1 to preserve the raw bytes the
// geometry parser matches on — UTF-8 would corrupt them.
export async function loadPatternDxfText(slug: string): Promise<{ filename: string; text: string } | null> {
  const files = await listPatternFiles(slug);
  const dxf = files.find((f) => f.format === "dxf");
  if (!dxf) return null;
  const sb = getSupabase();
  const { data, error } = await sb.storage.from(PATTERN_BUCKET).download(dxf.path);
  if (error || !data) return null;
  const buf = Buffer.from(await data.arrayBuffer());
  return { filename: dxf.filename, text: buf.toString("latin1") };
}

// --- 3D model (public bucket) -----------------------------------------------
// One GLB per SKU at `sku-models/<slug>.glb`. Returns the public URL (with an
// updated-at cache-buster so a re-upload invalidates the CDN/browser cache), or
// null when no model has been uploaded yet.
// Pre-rendered 3D still per SKU (sku-models/thumbs/<slug>.png) used as the
// product photo across grids. Returns slug → public URL for every thumb present.
export async function listModelThumbs(): Promise<Record<string, string>> {
  const sb = getSupabase();
  const { data, error } = await sb.storage.from(MODEL_BUCKET).list("thumbs", { limit: 1000 });
  if (error || !data) return {};
  const out: Record<string, string> = {};
  for (const o of data) {
    if (!o.name.endsWith(".png")) continue;
    const slug = o.name.replace(/\.png$/, "");
    const { data: pub } = sb.storage.from(MODEL_BUCKET).getPublicUrl(`thumbs/${o.name}`);
    const v = o.updated_at ?? o.created_at ?? "";
    out[slug] = v ? `${pub.publicUrl}?v=${encodeURIComponent(v)}` : pub.publicUrl;
  }
  return out;
}

export async function getModelUrl(slug: string): Promise<string | null> {
  const sb = getSupabase();
  const target = `${slug}.glb`;
  const { data, error } = await sb.storage.from(MODEL_BUCKET).list("", { limit: 1000, search: target });
  if (error || !data) return null;
  const hit = data.find((o) => o.name === target);
  if (!hit) return null;
  const { data: pub } = sb.storage.from(MODEL_BUCKET).getPublicUrl(target);
  const v = hit.updated_at ?? hit.created_at ?? "";
  return v ? `${pub.publicUrl}?v=${encodeURIComponent(v)}` : pub.publicUrl;
}
