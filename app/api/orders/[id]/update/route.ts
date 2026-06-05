// Self-serve order edit → re-proof. The customer adjusted their order in the
// configurator (edit mode); save the new config, regenerate the proof, and
// re-send the approval email. Zero human involvement for parametric changes.
// PUBLIC (token = order id); only works while the order is unapproved.
import { NextResponse } from "next/server";
import { getOrderById, updateOrderConfig, setOrderProof } from "@/lib/store";
import { generateProof } from "@/lib/proof";
import { sendProofApproval } from "@/lib/email";
import type { ShopOrder } from "@/lib/types";

export const runtime = "nodejs";
const ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN || "https://shop.magnumopus.agency";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.proofApprovedAt) return NextResponse.json({ error: "This order is already approved and in production." }, { status: 400 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const patch: Partial<ShopOrder> = {
    variantId: body.variantId ?? order.variantId,
    decorationIds: body.decorationIds ?? order.decorationIds,
    artworkFileUrl: body.artworkFileUrl ?? order.artworkFileUrl,
    artworkFileName: body.artworkFileName ?? order.artworkFileName,
    sizeBreakdown: body.sizeBreakdown ?? order.sizeBreakdown,
    artworkPlacement: body.artworkPlacement ?? order.artworkPlacement,
    artworkPlacements: body.artworkPlacements ?? order.artworkPlacements,
  };
  const updated = await updateOrderConfig(id, patch);
  if (!updated) return NextResponse.json({ error: "Update failed" }, { status: 500 });

  // Regenerate the proof from the new config, then re-send for approval.
  let proofUrl: string | null = null;
  try {
    proofUrl = await generateProof(updated, ORIGIN);
    if (proofUrl) await setOrderProof(id, proofUrl);
  } catch (err) {
    console.warn(`[order-update] proof regen failed for ${id}: ${err instanceof Error ? err.message : err}`);
  }
  const fresh = (await getOrderById(id)) ?? updated;
  if (proofUrl) await sendProofApproval(fresh, proofUrl, request);

  return NextResponse.json({ ok: true, proofUrl });
}
