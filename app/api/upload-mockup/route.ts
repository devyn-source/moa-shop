import { NextResponse } from "next/server";
import sharp from "sharp";
import { getSupabase } from "@/lib/supabase";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Save the actual rendered view shown in review. The original artwork and the
// inch measurements travel separately; this is the customer's visual reference.
export async function POST(request: Request) {
  try {
    if (!(await rateLimit("upload", clientIp(request)))) return NextResponse.json({ error: "Please wait a moment and try again." }, { status: 429 });
    const form = await request.formData();
    const file = form.get("file"), view = form.get("view");
    if (!(file instanceof File) || !["front", "back"].includes(String(view)) || file.size > 4 * 1024 * 1024) return NextResponse.json({ error: "Invalid mockup image." }, { status: 400 });
    const bytes = Buffer.from(await file.arrayBuffer());
    const meta = await sharp(bytes, { limitInputPixels: 12_000_000 }).metadata();
    if (!["png", "webp"].includes(meta.format ?? "") || !meta.width || !meta.height) return NextResponse.json({ error: "Invalid mockup image." }, { status: 400 });
    const image = await sharp(bytes).resize({ width: 1600, height: 2000, fit: "inside", withoutEnlargement: true }).webp({ quality: 95 }).toBuffer();
    const path = `mockups/${crypto.randomUUID()}/${view}.webp`;
    const storage = getSupabase().storage.from("artwork");
    const { error } = await storage.upload(path, image, { contentType: "image/webp", upsert: false });
    if (error) throw error;
    const { data } = await storage.createSignedUrl(path, 365 * 86400);
    if (!data?.signedUrl) { await storage.remove([path]); throw new Error("sign"); }
    return NextResponse.json({ url: data.signedUrl });
  } catch {
    return NextResponse.json({ error: "Your mockup could not be saved. Please try again." }, { status: 500 });
  }
}
