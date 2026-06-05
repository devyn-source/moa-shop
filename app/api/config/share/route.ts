import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { saveSharedConfig } from "@/lib/shared-config";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { slug, config } = (await req.json()) as { slug?: string; config?: unknown };
    if (!slug || !config || typeof config !== "object") {
      return NextResponse.json({ error: "slug + config required" }, { status: 400 });
    }
    const id = randomUUID().replace(/-/g, "").slice(0, 10);
    await saveSharedConfig(id, slug, config);
    return NextResponse.json({ id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
