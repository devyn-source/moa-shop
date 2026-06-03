// Reconcile cron: makes the catalog pipeline self-healing.
//  - Paid orders never pushed to MoaOS  → push them (catches webhook failures).
//  - Paid orders already pushed          → sync MoaOS status back to the tracker.
// Mode-gated (off/dry_run never push). Protected by CRON_SECRET.
import { NextResponse } from "next/server";
import { getOrdersNeedingFulfillment, getProofReminderCandidates, recordProofReminder } from "@/lib/store";
import { pushOrderToMoaOS, syncOrderFromMoaOS, fulfillmentMode } from "@/lib/catalog-fulfillment";
import { sendProofApproval } from "@/lib/email";

export const runtime = "nodejs";

function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true; // unset (local/dev) → allow
  const got = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return got === expected;
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const mode = fulfillmentMode();
  const orders = await getOrdersNeedingFulfillment();
  let pushed = 0;
  let synced = 0;

  for (const order of orders) {
    const f = order.fulfillment;
    if (!f?.catalogOrderId) {
      // Not yet in MoaOS — push (no-op in off/dry_run, where the webhook also wouldn't have).
      if (mode !== "off" && mode !== "dry_run") {
        const r = await pushOrderToMoaOS(order);
        if (r.pushed) pushed++;
      }
    } else {
      await syncOrderFromMoaOS(order);
      synced++;
    }
  }

  // Proof-approval nudges: paid orders the customer hasn't approved/rejected,
  // older than 2 days, ≤3 reminders, ≥2 days apart. Stops money sitting silently.
  let reminded = 0;
  try {
    const candidates = await getProofReminderCandidates();
    for (const o of candidates) {
      if (!o.proofUrl) continue;
      const r = await sendProofApproval(o, o.proofUrl, null, { reminder: true });
      if (r.sent) {
        await recordProofReminder(o.id);
        reminded++;
      }
    }
  } catch {
    /* reminders are best-effort */
  }

  return NextResponse.json({ mode, scanned: orders.length, pushed, synced, reminded });
}
