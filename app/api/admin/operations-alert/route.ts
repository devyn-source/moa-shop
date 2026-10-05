import { isAdminRequest, basicAuthValid, clerkEmail } from "@/lib/admin-auth";
import { auth } from "@clerk/nextjs/server";
import { prepareAlert, sendApprovedAlert } from "@/lib/operations-alert";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function GET(req: Request) {
  if (!await isAdminRequest(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("incident") || "";
  if (!uuid.test(id)) return Response.json({ error: "Invalid incident" }, { status: 400 });
  try { return Response.json(await prepareAlert(id), { headers: { "Cache-Control": "private, no-store" } }); }
  catch { return Response.json({ error: "Could not prepare incident alert" }, { status: 503 }); }
}
export async function POST(req: Request) {
  if (!await isAdminRequest(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (req.headers.get("origin") && req.headers.get("origin") !== new URL(req.url).origin) return Response.json({ error: "Cross-origin submission rejected" }, { status: 403 });
  if (!req.headers.get("content-type")?.startsWith("application/json")) return Response.json({ error: "JSON review required" }, { status: 415 });
  const user = await auth().catch(() => ({ userId: null }));
  if (!basicAuthValid(req) && (!user.userId || await clerkEmail(user.userId) !== "devyn@magnumopus.agency")) return Response.json({ error: "Devyn must approve the exact final alert" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (!uuid.test(body.incidentId || "") || !/^[a-f0-9]{64}$/.test(body.approvedHash || "")) return Response.json({ error: "Reviewed incident and content hash required" }, { status: 400 });
  try { return Response.json(await sendApprovedAlert(body.incidentId, body.approvedHash, user.userId || "admin-basic-auth")); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Alert delivery requires review" }, { status: 409 }); }
}
