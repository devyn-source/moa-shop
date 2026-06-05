// Self-serve "adjust your order" — the configurator pre-filled from an existing
// (unapproved) order. The customer changes placement / color / ink / artwork /
// sizes and regenerates their proof. PUBLIC (token = order id).
import { notFound } from "next/navigation";
import { getOrderById, getProductById } from "@/lib/store";
import { PdpConfigurator, type EditSeed } from "@/components/PdpConfigurator";

export const dynamic = "force-dynamic";

export default async function AdjustPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) notFound();
  const product = await getProductById(order.productId);
  if (!product) notFound();

  if (order.proofApprovedAt) {
    return (
      <main className="page">
        <div className="empty-state">
          Order {order.orderNumber} is already approved and in production. To change it, reply to your confirmation email.
        </div>
      </main>
    );
  }

  // Full placement set (multi-placement orders); the primary leads, extras
  // re-seed the saved-placement list so re-proofing keeps every location.
  const all = order.artworkPlacements ?? (order.artworkPlacement ? [order.artworkPlacement] : []);
  const p = all[0] ?? order.artworkPlacement;
  const extras = all.slice(1).map((pl, i) => ({
    id: `seed-${i}`,
    view: pl.view,
    zoneId: pl.zoneId,
    zoneLabel: pl.zoneLabel,
    box: pl.box,
    art: pl.art,
    artworkUrl: pl.artworkFileUrl ?? order.artworkFileUrl ?? "",
    artworkName: pl.artworkFileName ?? null,
    artMeta: null,
  })).filter((e) => e.artworkUrl);
  const seed: EditSeed = {
    orderId: order.id,
    variantId: order.variantId,
    decorationIds: order.decorationIds,
    pantones: p?.pantones,
    view: p?.view,
    zoneId: p?.zoneId,
    art: p?.art,
    artworkFileUrl: p?.artworkFileUrl ?? order.artworkFileUrl,
    artworkFileName: p?.artworkFileName ?? order.artworkFileName,
    sizeQty: order.sizeBreakdown,
    extraPlacements: extras.length ? extras : undefined,
  };

  return (
    <main className="page">
      <div className="config-head" style={{ marginBottom: 12 }}>
        <p className="eyebrow" style={{ color: "var(--color-terracotta)" }}>Adjust your order</p>
        <h1 className="page-title">Make your changes</h1>
        <p className="lede">
          Order {order.orderNumber} — change the placement, garment color, ink, artwork, or size run, then update your proof. Nothing is produced until you approve the new one.
        </p>
      </div>
      <PdpConfigurator product={product} editOrder={seed} />
    </main>
  );
}
