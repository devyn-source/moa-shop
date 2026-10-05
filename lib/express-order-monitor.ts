import { z } from "zod";
import { getSupabase } from "./supabase";
const snapshot = z.object({
  checkedAt: z.string().datetime(), scanned: z.number().int().min(0).max(1000),
  incidents: z.array(z.object({ key: z.string().regex(/^order:[A-Za-z0-9_-]+:(proof|hold|shipping)$/), category: z.enum(["proof", "hold", "shipping"]), summary: z.string().min(5).max(500) })).max(3000),
});
export async function monitorExpressOrders() {
  const base = process.env.MOAOS_EXPRESS_URL?.replace(/\/$/, "");
  if (!base || !process.env.EXPRESS_SECRET) throw new Error("Backend monitoring is not configured");
  const response = await fetch(`${base}/api/express/operations`, {
    headers: { "x-express-secret": process.env.EXPRESS_SECRET, ...(process.env.MOAOS_BYPASS ? { "x-vercel-protection-bypass": process.env.MOAOS_BYPASS } : {}) },
    cache: "no-store", signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Backend monitoring unavailable");
  const data = snapshot.parse(await response.json());
  if (Math.abs(Date.now() - Date.parse(data.checkedAt)) > 60_000) throw new Error("Backend snapshot is stale");
  const saved = await getSupabase().rpc("sync_express_order_incidents", { p_incidents: data.incidents });
  if (saved.error) throw new Error("Could not persist incident snapshot");
  return { scanned: data.scanned, open: data.incidents.length };
}
