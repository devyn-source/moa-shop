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
import { apiError } from "@/lib/errors";
import { zonesSaveSchema } from "@/lib/validation";
import { MODEL_STANDIN } from "@/lib/launch";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug: asked } = await params;
    // A style without its own zones reads its stand-in's (see MODEL_STANDIN).
    const slug = MODEL_STANDIN[asked] && !(await getProductZones(asked)) ? MODEL_STANDIN[asked] : asked;
    const [zones, calibration, measurements] = await Promise.all([
      getProductZones(slug),
      getProductCalibration(slug),
      getProductMeasurements(slug),
    ]);
    return NextResponse.json({ zones, calibration, measurements });
  } catch (error) {
    return apiError(error, { fallback: "Request failed.", status: 400 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  // Writes overwrite product placement zones/calibration/measurements — admin only.
  // (GET stays public: the PDP/configurator needs zones to render placement.)
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { slug } = await params;
    const parsed = zonesSaveSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const body = parsed.data;
    if (body.zones === undefined && body.calibration === undefined && body.measurements === undefined) {
      return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
    }
    if (body.zones !== undefined) await saveProductZones(slug, body.zones);
    if (body.calibration !== undefined) await saveProductCalibration(slug, body.calibration);
    if (body.measurements !== undefined) await saveProductMeasurements(slug, body.measurements);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, { fallback: "Request failed.", status: 400 });
  }
}
