import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { apiError } from "@/lib/errors";
import { MODEL_BUCKET, getModelUrl } from "@/lib/pattern-files";

// Admin-only (Basic Auth via proxy.ts). Stores ONE GLB per SKU in the PUBLIC
// sku-models bucket at <slug>.glb — rendered on the PDP 3D viewer.
export const runtime = "nodejs";

const MAX_BYTES = 50 * 1024 * 1024;

// glTF binary magic: ASCII "glTF" + little-endian version uint32 (expect 2).
function isGlb(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  if (buf.toString("ascii", 0, 4) !== "glTF") return false;
  const version = buf.readUInt32LE(4);
  return version === 2 || version === 1;
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Missing file" }, { status: 400 });
    if (file.size === 0) return NextResponse.json({ error: "That file is empty." }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large (50 MB max)." }, { status: 413 });
    if (!file.name.toLowerCase().endsWith(".glb")) {
      return NextResponse.json({ error: "3D model must be a .glb file (binary glTF)." }, { status: 415 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    if (!isGlb(buf)) {
      return NextResponse.json(
        { error: "That isn't a valid binary glTF (.glb). Export as GLB and try again." },
        { status: 422 }
      );
    }

    const supabase = getSupabase();
    // One model per SKU → fixed key, upsert replaces the prior version.
    const { error: upErr } = await supabase.storage
      .from(MODEL_BUCKET)
      .upload(`${slug}.glb`, new Uint8Array(buf), { contentType: "model/gltf-binary", upsert: true });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    const url = await getModelUrl(slug);
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    return apiError(err, { fallback: "Upload failed. Please try again." });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const supabase = getSupabase();
    const { error } = await supabase.storage.from(MODEL_BUCKET).remove([`${slug}.glb`]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, url: null });
  } catch (err) {
    return apiError(err, { fallback: "Delete failed. Please try again." });
  }
}
