import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { apiError } from "@/lib/errors";
import { PATTERN_BUCKET, listPatternFilesSigned } from "@/lib/pattern-files";

// Admin-only (Basic Auth via proxy.ts gates /api/admin/*). Stores CAD pattern
// files in the PRIVATE sku-patterns bucket; these go to MOA + vendors only.
export const runtime = "nodejs";

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB — matches bucket file_size_limit
const ALLOWED_EXT = new Set(["dxf", "ai", "plt"]);

function extOf(name: string): string {
  return name.toLowerCase().split(".").pop() ?? "";
}

// Strip traversal + control chars; keep it short and storage-safe.
function safeName(raw: string): string {
  const base = raw.replace(/\\/g, "/").split("/").pop() ?? "pattern";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").slice(0, 90) || "pattern";
}

// These files are never rendered in the browser, but still reject obviously
// wrong / active content (images, zip/office, HTML, SVG) so junk can't land.
function looksWrong(buf: Buffer): string | null {
  if (buf.length >= 4) {
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "a PNG image";
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "a JPEG image";
    if (buf.toString("ascii", 0, 4) === "RIFF") return "an image";
    if (buf[0] === 0x50 && buf[1] === 0x4b) return "a zip/office file";
  }
  const head = buf.toString("utf8", 0, 512).trimStart().toLowerCase();
  if (head.startsWith("<?xml") || head.includes("<svg")) return "an SVG";
  if (head.startsWith("<!doctype html") || head.startsWith("<html")) return "an HTML file";
  return null;
}

// Permissive per-format plausibility check (the extension is authoritative; this
// just catches a mislabeled file before it reaches a vendor).
function plausible(ext: string, buf: Buffer): boolean {
  const head = buf.toString("latin1", 0, 2048);
  if (ext === "dxf") return head.includes("SECTION") || head.startsWith("AutoCAD Binary DXF");
  if (ext === "ai") return head.startsWith("%PDF-") || head.startsWith("%!PS") || head.includes("Adobe Illustrator");
  if (ext === "plt") return /(^|[;\s])(IN|PU|PD|SP|PA|PR)[;0-9]/.test(head) || head.charCodeAt(0) === 0x1b;
  return false;
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Missing file" }, { status: 400 });
    if (file.size === 0) return NextResponse.json({ error: "That file is empty." }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large (50 MB max)." }, { status: 413 });

    const ext = extOf(file.name);
    if (!ALLOWED_EXT.has(ext)) {
      return NextResponse.json(
        { error: `Unsupported file type .${ext || "(none)"}. Pattern files must be DXF, AI, or PLT.` },
        { status: 415 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const wrong = looksWrong(buf);
    if (wrong) {
      return NextResponse.json({ error: `That looks like ${wrong}, not a CAD pattern file.` }, { status: 415 });
    }
    if (!plausible(ext, buf)) {
      return NextResponse.json(
        { error: `That doesn't look like a valid .${ext} pattern file. Re-export and try again.` },
        { status: 422 }
      );
    }

    const supabase = getSupabase();
    const path = `${slug}/${safeName(file.name)}`;
    // upsert: re-uploading the same filename replaces it (a corrected revision).
    const { error: upErr } = await supabase.storage
      .from(PATTERN_BUCKET)
      .upload(path, new Uint8Array(buf), { contentType: "application/octet-stream", upsert: true });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    const files = await listPatternFilesSigned(slug);
    return NextResponse.json({ ok: true, files });
  } catch (err) {
    return apiError(err, { fallback: "Upload failed. Please try again." });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { path } = (await request.json().catch(() => ({}))) as { path?: string };
    // Confine deletes to this SKU's own folder — never trust a client path.
    if (!path || !path.startsWith(`${slug}/`) || path.includes("..")) {
      return NextResponse.json({ error: "Invalid path." }, { status: 400 });
    }
    const supabase = getSupabase();
    const { error } = await supabase.storage.from(PATTERN_BUCKET).remove([path]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const files = await listPatternFilesSigned(slug);
    return NextResponse.json({ ok: true, files });
  } catch (err) {
    return apiError(err, { fallback: "Delete failed. Please try again." });
  }
}
