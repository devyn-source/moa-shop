// Save / lock a Garment Passport (admin Basic-Auth gated via proxy.ts).
import { NextResponse } from "next/server";
import { saveCatalogSpec } from "@/lib/garment-spec-store";
import { isPassportLocked, type GarmentPassport } from "@/lib/garment-spec";
import { apiError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const body = (await req.json().catch(() => null)) as { spec?: GarmentPassport; approve?: boolean } | null;
    if (!body?.spec) return NextResponse.json({ error: "Missing spec" }, { status: 400 });

    const status = body.approve ? "approved" : "reviewed";
    // Lock only when set in stone — nothing assumed, no open questions.
    if (status === "approved" && !isPassportLocked({ ...body.spec, _status: "approved" })) {
      return NextResponse.json(
        { error: "Can't lock yet — confirm every assumed field and resolve all open questions first." },
        { status: 400 }
      );
    }
    await saveCatalogSpec(slug, body.spec, status);
    return NextResponse.json({ ok: true, status });
  } catch (e) {
    return apiError(e, { fallback: "Couldn't save the spec.", status: 500 });
  }
}
