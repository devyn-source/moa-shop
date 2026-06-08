import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { saveSharedConfig } from "@/lib/shared-config";
import { configShareSchema } from "@/lib/validation";
import { apiError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { slug, config } = configShareSchema.parse(await req.json());
    if (!config || typeof config !== "object") {
      return NextResponse.json({ error: "slug + config required" }, { status: 400 });
    }
    const id = randomUUID().replace(/-/g, "").slice(0, 10);
    await saveSharedConfig(id, slug, config);
    return NextResponse.json({ id });
  } catch (e) {
    return apiError(e, { fallback: "Couldn't save that configuration.", status: 500 });
  }
}
