import { NextResponse } from "next/server";
import { reconcileExpressRefunds } from "@/lib/express-refunds";

export const maxDuration = 120;

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await reconcileExpressRefunds();
    if (result.failed) console.error("[express-refund-recovery] Operator review required", result);
    return NextResponse.json(result, { status: result.failed ? 503 : 200, headers: { "Cache-Control": "no-store" } });
  }
  catch { return NextResponse.json({ error: "Refund queue needs retry" }, { status: 503 }); }
}
