import { NextResponse } from "next/server";
import {
  getProductZones,
  saveProductZones,
  getProductCalibration,
  saveProductCalibration,
  getProductMeasurements,
  saveProductMeasurements,
} from "@/lib/store";
import { isAdminRequest } from "@/lib/admin-auth";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const [zones, calibration, measurements] = await Promise.all([
      getProductZones(slug),
      getProductCalibration(slug),
      getProductMeasurements(slug),
    ]);
    return NextResponse.json({ zones, calibration, measurements });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 400 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  // Writes overwrite product placement zones/calibration/measurements — admin only.
  // (GET stays public: the PDP/configurator needs zones to render placement.)
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { slug } = await params;
    const body = (await request.json()) as { zones?: unknown; calibration?: unknown; measurements?: unknown };
    if (body?.zones === undefined && body?.calibration === undefined && body?.measurements === undefined) {
      return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
    }
    if (body.zones !== undefined) await saveProductZones(slug, body.zones);
    if (body.calibration !== undefined) await saveProductCalibration(slug, body.calibration);
    if (body.measurements !== undefined) await saveProductMeasurements(slug, body.measurements);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 400 });
  }
}
