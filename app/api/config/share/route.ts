import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { saveSharedConfig } from "@/lib/shared-config";
import { currentCustomerEmail } from "@/lib/order-access";
import { configShareSchema } from "@/lib/validation";
import { apiError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { slug, config } = configShareSchema.parse(await req.json());
    if (!config || typeof config !== "object") {
      return NextResponse.json({ error: "slug + config required" }, { status: 400 });
    }
    // Associate the design with the signed-in customer (server-side Clerk
    // session — never a client-supplied email) so it shows under "Saved
    // designs" on /orders. Anonymous shares stay fully supported (null).
    const email = await currentCustomerEmail();
    const id = randomUUID().replace(/-/g, "").slice(0, 10);
    await saveSharedConfig(id, slug, config, email);
    return NextResponse.json({ id });
  } catch (e) {
    return apiError(e, { fallback: "Couldn't save that configuration.", status: 500 });
  }
}
