import { NextResponse } from "next/server";
import { getProducts } from "@/lib/store";

// Per-SKU costing snapshot for the MoaOS landed-cost / tariff model
// (/catalog/costing). Exposes vendor landed cost + price ladder — internal
// only, secured by the same shared secrets as the analytics summary.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authed(req: Request): boolean {
  const secrets = [process.env.MOAOS_INTAKE_SECRET, process.env.INTERNAL_API_SECRET].filter(Boolean) as string[];
  if (!secrets.length) return process.env.NODE_ENV !== "production"; // fail CLOSED in prod
  const got = req.headers.get("x-moa-secret") || req.headers.get("x-moa-internal-secret");
  return Boolean(got && secrets.includes(got));
}

export async function GET(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const products = await getProducts();
  const skus = products
    .filter((p) => p.isPublished && (p.vendorUnitCostUsd ?? 0) > 0 && (p.priceTiers?.length ?? 0) > 0)
    .map((p) => ({
      slug: p.slug,
      name: p.displayName,
      landedUsd: p.vendorUnitCostUsd,
      moq: p.moq,
      entryUsd: p.priceTiers[0].perUnitUsd,
      floorUsd: p.priceTiers[p.priceTiers.length - 1].perUnitUsd,
      fabrics: (p.fabricOptions ?? []).map((f) => ({ tier: f.tier, label: f.label, upchargeUsd: f.upchargeUsd })),
    }));

  return NextResponse.json({ generatedAt: new Date().toISOString(), skus });
}
