import "server-only";
// Auto-generated proof: composites the garment shot + the customer's placed
// artwork (using the structured ArtworkPlacement) into a single PNG — the image
// the customer approves. That approval IS the QA (replaces human mockup review).
import sharp from "sharp";
import { getSupabase } from "./supabase";
import { getProductById } from "./store";
import { hexToRgb } from "./pantones";
import type { ShopOrder } from "./types";

const W = 1000;
const H = 1250; // 4:5 canvas, matching the configurator stage

async function fetchBuf(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

// Returns the public proof URL, or null if it can't be built (caller falls back).
export async function generateProof(order: ShopOrder, origin: string): Promise<string | null> {
  const product = await getProductById(order.productId);
  if (!product) return null;
  const variant = product.variants.find((v) => v.id === order.variantId);
  const p = order.artworkPlacement;
  const view = p?.view ?? "front";
  const garmentPath =
    view === "back" ? product.greyBack || variant?.backImage : variant?.frontImage || product.greyFront;
  if (!garmentPath) return null;

  const garmentBuf = await fetchBuf(`${origin}${garmentPath}`);
  if (!garmentBuf) return null;

  const base = sharp(garmentBuf).resize(W, H, { fit: "contain", background: "#FFFFFF" });
  const layers: sharp.OverlayOptions[] = [];

  // Composite the placed artwork (raster or SVG; PDF art falls back to garment-only).
  if (order.artworkFileUrl && p) {
    const artBuf = await fetchBuf(order.artworkFileUrl);
    if (artBuf) {
      try {
        const bx = p.box.x * W;
        const by = p.box.y * H;
        const bw = p.box.w * W;
        const bh = p.box.h * H;
        const aw = Math.max(1, Math.round(p.art.sx * bw));
        const ah = Math.max(1, Math.round(p.art.sy * bh));
        // Single-color spot print on transparent art → reproduce the art shape in
        // the chosen PMS ink (true 1-color screen print look). Multi-color or opaque
        // art shows as-is (its colors are the declared spot spec).
        const origMeta = await sharp(artBuf).metadata();
        const onePms = p.pantones?.length === 1 ? p.pantones[0] : null;
        const recolor = onePms && origMeta.hasAlpha;

        let art = sharp(artBuf).resize(aw, ah, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });
        const rot = (p.art.r ?? 0) + (p.box.r ?? 0);
        if (rot) art = art.rotate(rot, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
        let artPng = await art.png().toBuffer();

        if (recolor && onePms) {
          const rm = await sharp(artPng).metadata();
          const { r, g, b } = hexToRgb(onePms.hex);
          const alpha = await sharp(artPng).ensureAlpha().extractChannel(3).toColourspace("b-w").toBuffer();
          artPng = await sharp({ create: { width: rm.width ?? aw, height: rm.height ?? ah, channels: 3, background: { r, g, b } } })
            .joinChannel(alpha)
            .png()
            .toBuffer();
        }
        const m = await sharp(artPng).metadata();
        const cx = bx + p.art.ox * bw + aw / 2;
        const cy = by + p.art.oy * bh + ah / 2;
        const left = Math.round(cx - (m.width ?? aw) / 2);
        const top = Math.round(cy - (m.height ?? ah) / 2);
        layers.push({ input: artPng, left: Math.max(0, Math.min(W - 1, left)), top: Math.max(0, Math.min(H - 1, top)) });
      } catch {
        /* unsupported art (e.g. PDF) → proof shows the garment alone */
      }
    }
  }

  const out = await base.composite(layers).png().toBuffer();
  const supabase = getSupabase();
  const path = `proofs/${order.id}.png`;
  const { error } = await supabase.storage
    .from("artwork")
    .upload(path, new Uint8Array(out), { contentType: "image/png", upsert: true });
  if (error) return null;
  return supabase.storage.from("artwork").getPublicUrl(path).data.publicUrl;
}
