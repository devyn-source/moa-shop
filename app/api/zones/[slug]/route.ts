import { NextResponse } from "next/server";
import { getProductZones, saveProductZones } from "@/lib/store";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const zones = await getProductZones(slug);
    return NextResponse.json({ zones });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 400 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const body = (await request.json()) as { zones: unknown };
    if (!body?.zones) {
      return NextResponse.json({ error: "Missing zones" }, { status: 400 });
    }
    await saveProductZones(slug, body.zones);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 400 });
  }
}
