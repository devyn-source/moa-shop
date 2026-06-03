import { NextResponse } from "next/server";
import { autoCalibrate } from "@/lib/autocalibrate";
import { saveProductCalibration } from "@/lib/store";

// POST /api/admin/auto-calibrate/[slug] — detect the garment silhouette in the
// SKU's base mockup, scale it to the stored spec, save the calibration, and
// return it + a confidence so the operator can review flagged SKUs in Studio.
// Gated by the /api/admin Basic Auth (proxy.ts).
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const origin = process.env.NEXT_PUBLIC_SITE_ORIGIN || new URL(req.url).origin;
    const result = await autoCalibrate(slug, origin);
    if (!result.ok) return NextResponse.json(result, { status: 422 });
    await saveProductCalibration(slug, result.calibration);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}
