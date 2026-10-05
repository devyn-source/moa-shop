import { isAdminRequest } from "@/lib/admin-auth";
import { getExpressOperations } from "@/lib/express-operations";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  if (!await isAdminRequest(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const report = await getExpressOperations();
  return Response.json(report, { status: report.checks.some(check => check.state !== "pass") ? 503 : 200, headers: { "Cache-Control": "private, no-store" } });
}
