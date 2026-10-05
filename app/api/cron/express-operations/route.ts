import { monitoredJob } from "@/lib/job-monitor";
import { monitorExpressOrders } from "@/lib/express-order-monitor";
export const maxDuration = 30;
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await monitoredJob("express-operations", monitorExpressOrders);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Order monitoring requires review" }, { status: 503 });
  }
}
