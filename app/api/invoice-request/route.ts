import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { notifyOps } from "@/lib/email";
import { trackServer } from "@/lib/analytics-server";
import { currentCustomerEmail } from "@/lib/order-access";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { invoiceRequestSchema } from "@/lib/validation";
import { apiError } from "@/lib/errors";

// "Pay by invoice / PO" hand-raise from checkout. Stores the lead, tracks the
// signal, pings Devyn — a real person replies within one business day. This is
// a request lane only: it never touches Stripe, the cart, or order state.
export const runtime = "nodejs";

const INVOICE_REQUEST_EMAIL = process.env.CATALOG_INVOICE_REQUEST_EMAIL || "devyn@magnumopus.agency";

// User-controlled strings go into the notification HTML — escape them.
const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function POST(request: Request) {
  try {
    if (!(await rateLimit("invoice", clientIp(request)))) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }
    const parsed = invoiceRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Please check the required fields and try again." }, { status: 400 });
    }
    const d = parsed.data;
    // Signed-in identity (when present) — server-side Clerk session, kept
    // separate from the work email the buyer typed.
    const customerEmail = await currentCustomerEmail();

    const { error } = await getSupabase().from("invoice_requests").insert({
      company_name: d.companyName,
      work_email: d.workEmail,
      po_number: d.poNumber ?? null,
      note: d.note ?? null,
      customer_email: customerEmail,
    });
    if (error) throw new Error(`invoice request insert failed: ${error.message}`);

    // Funnel signal: sustained volume here = build the full invoice/PO payment
    // path (launch plan, GATE 2).
    await trackServer(
      "invoice_requested",
      { company: d.companyName, has_po: Boolean(d.poNumber) },
      d.workEmail
    );

    await notifyOps(
      `Invoice/PO request — ${d.companyName}`,
      `<p><strong>${esc(d.companyName)}</strong> asked to pay by invoice/PO from checkout.</p>
       <p>Work email: ${esc(d.workEmail)}<br/>PO number: ${esc(d.poNumber || "—")}<br/>Signed-in account: ${esc(customerEmail || "—")}</p>
       ${d.note ? `<p>Note: ${esc(d.note)}</p>` : ""}
       <p>They were told a real person will reply within one business day.</p>`,
      INVOICE_REQUEST_EMAIL
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, { fallback: "Couldn't send the request. Please try again.", status: 400 });
  }
}
