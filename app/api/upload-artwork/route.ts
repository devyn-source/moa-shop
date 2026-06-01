import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB — matches bucket file_size_limit
const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/webp",
  "application/pdf"
]);

// Strips traversal + control chars, keeps name short and url-safe.
function safeName(raw: string): string {
  const base = raw
    .replace(/\\/g, "/")
    .split("/")
    .pop() ?? "artwork";
  return base
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80) || "artwork";
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (50 MB max)" }, { status: 413 });
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type ${file.type || "(unknown)"}. PNG, JPG, SVG, WEBP, PDF only.` },
        { status: 415 }
      );
    }

    const supabase = getSupabase();
    const id = crypto.randomUUID();
    const path = `${id}/${safeName(file.name)}`;
    const arrayBuf = await file.arrayBuffer();
    const { error: upErr } = await supabase.storage
      .from("artwork")
      .upload(path, new Uint8Array(arrayBuf), { contentType: file.type, upsert: false });
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
    const { data } = supabase.storage.from("artwork").getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl, fileName: file.name, contentType: file.type, bytes: file.size });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
