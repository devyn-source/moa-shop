import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { postExpressDecision } from "@/lib/express-account";

// The signed-in customer approves a piece or requests a change. Their email
// comes from the session, never from the request body.
export async function POST(request: Request) {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) return NextResponse.json({ error: "Sign in to review your proof" }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as { number?: string; skuId?: string; decision?: string; comment?: string };
  if (!b.number || !b.skuId || (b.decision !== "approved" && b.decision !== "changes")) return NextResponse.json({ error: "Missing decision" }, { status: 400 });
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || email;
  const r = await postExpressDecision({ number: b.number, email, name, skuId: b.skuId, decision: b.decision, comment: b.comment });
  if (!r.ok) return NextResponse.json({ error: r.error || "Could not save your decision" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
