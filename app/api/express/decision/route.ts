import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { postExpressDecision } from "@/lib/express-account";

// The signed-in customer approves a piece or requests a change. Their email
// comes from the session, never from the request body.
export async function POST(request: Request) {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) return NextResponse.json({ error: "Sign in to review your proof" }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as { number?: string; skuId?: string; round?: number; decision?: string; comment?: string };
  if (!b.number || !b.skuId || (b.decision !== "approved" && b.decision !== "changes")) return NextResponse.json({ error: "Missing decision" }, { status: 400 });
  if (!Number.isInteger(b.round) || (b.round || 0) < 1) return NextResponse.json({ error: "Refresh the page to review the current proof version" }, { status: 409 });
  if (b.comment !== undefined && (typeof b.comment !== "string" || b.comment.length > 4000)) return NextResponse.json({ error: "Keep your change request under 4,000 characters" }, { status: 400 });
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || email;
  try {
    const r = await postExpressDecision({ number: b.number, email, name, skuId: b.skuId, round: b.round!, decision: b.decision, comment: b.comment });
    if (!r.ok) return NextResponse.json({ error: r.error || "Could not save your decision" }, { status: r.status >= 400 && r.status < 600 ? r.status : 502 });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Could not reach your order. Please try again." }, { status: 503 }); }
}
