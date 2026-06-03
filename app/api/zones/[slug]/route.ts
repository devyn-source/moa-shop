import { NextResponse } from "next/server";
import {
  getProductZones,
  saveProductZones,
  getProductCalibration,
  saveProductCalibration,
} from "@/lib/store";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const [zones, calibration] = await Promise.all([getProductZones(slug), getProductCalibration(slug)]);
    return NextResponse.json({ zones, calibration });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 400 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const body = (await request.json()) as { zones?: unknown; calibration?: unknown };
    if (body?.zones === undefined && body?.calibration === undefined) {
      return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
    }
    if (body.zones !== undefined) await saveProductZones(slug, body.zones);
    if (body.calibration !== undefined) await saveProductCalibration(slug, body.calibration);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 400 });
  }
}
