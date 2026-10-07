import { auth } from "@clerk/nextjs/server";
import { isAdminRequest, clerkEmail, emailIsAdmin } from "@/lib/admin-auth";
import { staffService } from "@/lib/express-staff";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  if (!await isAdminRequest(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const number = new URL(req.url).searchParams.get("number") || undefined;
  if (number && !/^EXP-[A-Za-z0-9-]{1,75}$/.test(number)) return Response.json({ error: "Invalid order number" }, { status: 400 });
  return staffService(number);
}
export async function POST(req: Request) {
  // Mutations require a named, verified Clerk operator, including in local development.
  const session = await auth().catch(() => null);
  if (!session?.userId) return Response.json({ error: "Staff sign-in required" }, { status: 401 });
  const actor = await clerkEmail(session.userId);
  if (!actor || !emailIsAdmin(actor)) return Response.json({ error: "Staff access required" }, { status: 403 });
  if (req.headers.get("origin") !== new URL(req.url).origin || !req.headers.get("content-type")?.startsWith("application/json")) return Response.json({ error: "Same-origin JSON required" }, { status: 403 });
  const raw = await req.text();
  if (raw.length > 150000) return Response.json({ error: "Request too large" }, { status: 413 });
  let body;
  try { body = JSON.parse(raw); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body || !["proof", "fulfillment"].includes(body.kind) || typeof body.number !== "string" || !/^EXP-[A-Za-z0-9-]{1,75}$/.test(body.number)) return Response.json({ error: "Invalid staff action" }, { status: 400 });
  return staffService(undefined, body, actor);
}
