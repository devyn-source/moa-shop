import "server-only";
// Auto-generated proof: composites the garment shot(s) + the customer's placed
// artwork (using the structured ArtworkPlacement set) into a single PNG — the
// image the customer approves. That approval IS the QA (replaces human mockup
// review). Multi-placement orders render every location: each view (front/back)
// becomes a side-by-side panel with all of that view's placements composited.
import sharp from "sharp";
import { getSupabase } from "./supabase";
import { getProductById } from "./store";
import { hexToRgb } from "./pantones";
import type { ArtworkPlacement, ShopOrder } from "./types";

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

// Build a single placement's composited-art layer for a W×H panel, offset to
// the panel's column. Returns null for unsupported art (e.g. PDF) or no file.
async function artLayerFor(
  pl: ArtworkPlacement,
  fallbackUrl: string | undefined,
  offsetX: number
): Promise<sharp.OverlayOptions | null> {
  const url = pl.artworkFileUrl ?? fallbackUrl;
  if (!url) return null;
  const artBuf = await fetchBuf(url);
  if (!artBuf) return null;
  try {
    const bx = pl.box.x * W;
    const by = pl.box.y * H;
    const bw = pl.box.w * W;
    const bh = pl.box.h * H;
    const aw = Math.max(1, Math.round(pl.art.sx * bw));
    const ah = Math.max(1, Math.round(pl.art.sy * bh));
    // Single-color spot print on transparent art → reproduce the art shape in
    // the chosen PMS ink (true 1-color screen print look). Multi-color or opaque
    // art shows as-is (its colors are the declared spot spec).
    const origMeta = await sharp(artBuf).metadata();
    const onePms = pl.pantones?.length === 1 ? pl.pantones[0] : null;
    const recolor = onePms && origMeta.hasAlpha;

    let art = sharp(artBuf).resize(aw, ah, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });
    const rot = (pl.art.r ?? 0) + (pl.box.r ?? 0);
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
    const cx = bx + pl.art.ox * bw + aw / 2;
    const cy = by + pl.art.oy * bh + ah / 2;
    const left = Math.round(cx - (m.width ?? aw) / 2) + offsetX;
    const top = Math.round(cy - (m.height ?? ah) / 2);
    return {
      input: artPng,
      left: Math.max(offsetX, Math.min(offsetX + W - 1, left)),
      top: Math.max(0, Math.min(H - 1, top)),
    };
  } catch {
    /* unsupported art (e.g. PDF) → that placement shows the garment alone */
    return null;
  }
}

// Returns the public proof URL, or null if it can't be built (caller falls back).
export async function generateProof(order: ShopOrder, origin: string): Promise<string | null> {
  const product = await getProductById(order.productId);
  if (!product) return null;
  const variant = product.variants.find((v) => v.id === order.variantId);

  // Full placement set (back-compat: fall back to the singular primary).
  const placements: ArtworkPlacement[] = order.artworkPlacements?.length
    ? order.artworkPlacements
    : order.artworkPlacement
    ? [order.artworkPlacement]
    : [];

  const garmentFor = (v: "front" | "back") =>
    v === "back" ? product.greyBack || variant?.backImage : variant?.frontImage || product.greyFront;

  // One panel per distinct view that has a placement, front first. No
  // placements (blank garment) → a single front panel.
  const present = new Set(placements.map((pl) => pl.view));
  const views: ("front" | "back")[] = (["front", "back"] as const).filter((v) => present.has(v));
  if (views.length === 0) views.push("front");

  const canvasW = W * views.length;
  const base = sharp({
    create: { width: canvasW, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  });
  const layers: sharp.OverlayOptions[] = [];

  for (let i = 0; i < views.length; i++) {
    const v = views[i];
    const offsetX = i * W;
    const gp = garmentFor(v);
    if (gp) {
      const gbuf = await fetchBuf(`${origin}${gp}`);
      if (gbuf) {
        const gpng = await sharp(gbuf).resize(W, H, { fit: "contain", background: "#FFFFFF" }).png().toBuffer();
        layers.push({ input: gpng, left: offsetX, top: 0 });
      } else if (views.length === 1) {
        // Single-view proof and we couldn't load the garment → nothing to show.
        return null;
      }
    }
    // Composite each placement on this view (garment is already beneath them).
    for (const pl of placements.filter((pp) => pp.view === v)) {
      const al = await artLayerFor(pl, order.artworkFileUrl, offsetX);
      if (al) layers.push(al);
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
