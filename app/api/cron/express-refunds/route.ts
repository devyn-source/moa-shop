import { NextResponse } from "next/server";
import { reconcileExpressRefunds } from "@/lib/express-refunds";

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json({ recovered: await reconcileExpressRefunds() }); }
  catch { return NextResponse.json({ error: "Refund queue needs retry" }, { status: 503 }); }
}
