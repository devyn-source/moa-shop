import { NextResponse } from "next/server";
import sharp from "sharp";
import { getSupabase } from "@/lib/supabase";
import { apiError } from "@/lib/errors";

export const runtime = "nodejs";

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB — matches bucket file_size_limit
const SIGNED_URL_TTL = 60 * 60 * 24 * 365; // 1 year — spans the order lifecycle + email + vendor handoff
// SVG is intentionally NOT accepted: it's an active document (script/XSS surface)
// and sanitizing it reliably is hard. PDF covers the vector/print use case.
const VECTOR = new Set(["application/pdf"]);
const RASTER = new Set(["image/png", "image/jpeg", "image/webp"]);
const ALLOWED = new Set([...VECTOR, ...RASTER]);

// Server-side content sniff (magic bytes) — never trust the client-supplied MIME.
// Returns the real type, or flags svg/html so renamed uploads are rejected.
function sniffType(buf: Buffer): string | null {
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf.length >= 5 && buf.toString("ascii", 0, 5) === "%PDF-") return "application/pdf";
  const head = buf.toString("utf8", 0, 256).trimStart().toLowerCase();
  if (head.startsWith("<?xml") || head.includes("<svg")) return "image/svg+xml";
  if (head.startsWith("<!doctype html") || head.startsWith("<html")) return "text/html";
  return null;
}

// Print-readiness thresholds. Long-edge pixels is a robust proxy for "enough
// resolution for a typical decoration" without yet knowing the exact print size.
const MIN_LONG_EDGE = 1200;
const MIN_DENSITY = 150;

// Strips traversal + control chars, keeps name short and url-safe.
function safeName(raw: string): string {
  const base = raw.replace(/\\/g, "/").split("/").pop() ?? "artwork";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").slice(0, 80) || "artwork";
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "That file is empty." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (50 MB max)." }, { status: 413 });
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type ${file.type || "(unknown)"}. Use PNG, JPG, WEBP, or PDF (vector).` },
        { status: 415 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());

    // Verify the real content type (magic bytes) — reject renamed/spoofed files
    // and anything active (svg/html). This is the authoritative type check.
    const sniffed = sniffType(buf);
    if (!sniffed || !ALLOWED.has(sniffed)) {
      return NextResponse.json(
        { error: "That file isn't a valid PNG, JPG, WEBP, or PDF. (SVG/HTML and renamed files aren't accepted.)" },
        { status: 415 }
      );
    }

    // --- Automated print-readiness validation (the QA-killer file gate) -------
    let warning: string | undefined;
    let kind: "vector" | "raster" = "vector";
    let meta: { width?: number; height?: number; density?: number; space?: string } = {};

    if (RASTER.has(file.type)) {
      kind = "raster";
      try {
        const m = await sharp(buf).metadata();
        meta = { width: m.width, height: m.height, density: m.density, space: m.space };
      } catch {
        return NextResponse.json(
          { error: "Couldn't read this image — it may be corrupt. Re-export and try again." },
          { status: 422 }
        );
      }
      const w = meta.width ?? 0;
      const h = meta.height ?? 0;
      const longEdge = Math.max(w, h);
      if (longEdge < MIN_LONG_EDGE) {
        return NextResponse.json(
          {
            error: `This image is too low-resolution for print (${w}×${h}px). Upload at least ${MIN_LONG_EDGE}px on the longest side, or a vector file (SVG/PDF) for crisp results at any size.`,
          },
          { status: 422 }
        );
      }
      if (meta.space === "cmyk") {
        warning = "Heads up: this file is CMYK — colors can shift on screen and in print. RGB or a vector file is preferred.";
      } else if (meta.density && meta.density < MIN_DENSITY) {
        warning = `Low DPI (${meta.density}). It'll work at smaller sizes, but a higher-resolution or vector file is safer for large prints.`;
      }
    }

    // --- Validation passed → store (rejected files never hit storage) --------
    const supabase = getSupabase();
    const id = crypto.randomUUID();
    const path = `${id}/${safeName(file.name)}`;
    const { error: upErr } = await supabase.storage
      .from("artwork")
      .upload(path, new Uint8Array(buf), { contentType: sniffed, upsert: false });
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
    // Private bucket → a long-lived SIGNED url (token required; not guessable /
    // enumerable like a public url). Covers the order lifecycle + email + MoaOS.
    const { data: signed, error: signErr } = await supabase.storage.from("artwork").createSignedUrl(path, SIGNED_URL_TTL);
    if (signErr || !signed?.signedUrl) {
      return NextResponse.json({ error: "Stored, but couldn't sign the file URL. Please retry." }, { status: 500 });
    }
    return NextResponse.json({
      url: signed.signedUrl,
      path,
      fileName: file.name,
      contentType: sniffed,
      bytes: file.size,
      kind,
      meta,
      warning,
    });
  } catch (err) {
    return apiError(err, { fallback: "Upload failed. Please try again.", status: 500 });
  }
}
