// Reads and updates a client's MOA Express order in MoaOS, which is the source
// of truth for proofs, rounds, the invoice and status. Server-only: the
// caller must already have the signed-in customer's email.

export type ExpressPiece = { skuId: string | null; ref: string; title: string; qty: number; summary: string; decision: "pending" | "approved" | "changes" | null; comment: string | null; mockups: string[]; spec: string };
export type ExpressRound = { round: number; sentAt: string; closedAt: string | null; items: { skuId: string; title: string; decision: string; comment: string | null; decidedAt: string | null; decidedBy: string | null }[] };
export type ExpressOrderView = {
  orderNumber: string; mode: "live" | "sandbox"; status: string; statusLabel: string; submittedAt: string; proofDueAt: string | null; company: string;
  pieces: ExpressPiece[]; allApproved: boolean; openRound: { round: number; sentAt: string } | null; rounds: ExpressRound[]; includedRounds: number;
  invoice: { total: number; due: number; url: string | null; payUrl: string | null; paid: boolean; canPay: boolean };
  tracking: { carrier?: string; number?: string; url?: string } | null; launchedAt: string | null; shippedAt: string | null;
};

function base() { return (process.env.MOAOS_EXPRESS_URL || "").replace(/\/$/, ""); }
function headers(): Record<string, string> {
  return { "Content-Type": "application/json", "x-express-secret": process.env.EXPRESS_SECRET || "", ...(process.env.MOAOS_BYPASS ? { "x-vercel-protection-bypass": process.env.MOAOS_BYPASS } : {}) };
}

export async function getExpressOrder(number: string, email: string): Promise<ExpressOrderView | null> {
  if (!base()) return null;
  const r = await fetch(`${base()}/api/express/customer?number=${encodeURIComponent(number)}&email=${encodeURIComponent(email)}`, { headers: headers(), cache: "no-store" });
  if (!r.ok) return null;
  const j = (await r.json().catch(() => null)) as { ok?: boolean; order?: ExpressOrderView } | null;
  return j?.ok && j.order ? j.order : null;
}

export async function postExpressDecision(input: { number: string; email: string; name: string; skuId: string; decision: "approved" | "changes"; comment?: string }) {
  const r = await fetch(`${base()}/api/express/customer/decision`, { method: "POST", headers: headers(), body: JSON.stringify(input) });
  const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  return { ok: !!j.ok && r.ok, error: j.error };
}

export async function sandboxPay(number: string) {
  const r = await fetch(`${base()}/api/express/sandbox/pay`, { method: "POST", headers: headers(), body: JSON.stringify({ number }) });
  return r.ok;
}
