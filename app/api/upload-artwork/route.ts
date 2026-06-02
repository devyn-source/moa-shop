import { NextResponse } from "next/server";
import sharp from "sharp";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB — matches bucket file_size_limit
const VECTOR = new Set(["image/svg+xml", "application/pdf"]); // scalable → print-ready
const RASTER = new Set(["image/png", "image/jpeg", "image/webp"]);
const ALLOWED = new Set([...VECTOR, ...RASTER]);

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
        { error: `Unsupported file type ${file.type || "(unknown)"}. Use PNG, JPG, WEBP, SVG, or PDF.` },
        { status: 415 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());

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
      .upload(path, new Uint8Array(buf), { contentType: file.type, upsert: false });
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
    const { data } = supabase.storage.from("artwork").getPublicUrl(path);
    return NextResponse.json({
      url: data.publicUrl,
      fileName: file.name,
      contentType: file.type,
      bytes: file.size,
      kind,
      meta,
      warning,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
