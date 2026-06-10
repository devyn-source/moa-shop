import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { notifyOps } from "@/lib/email";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { sampleRequestSchema } from "@/lib/validation";
import { apiError } from "@/lib/errors";

// Sample-kit request intake. Stores the lead, pings ops — fulfillment itself is
// manual by design (each kit is approved by a human; see the sample-kit SOP).
export const runtime = "nodejs";

// User-controlled strings go into the ops email HTML — escape them.
const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function POST(request: Request) {
  try {
    if (!(await rateLimit("samples", clientIp(request)))) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }
    const parsed = sampleRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Please check the required fields and try again." }, { status: 400 });
    }
    const d = parsed.data;

    const supabase = getSupabase();
    const { error } = await supabase.from("sample_requests").insert({
      contact_name: d.contactName,
      contact_email: d.contactEmail,
      company_name: d.companyName,
      role_title: d.roleTitle ?? null,
      ship_to: d.shipTo,
      interested_slugs: d.interestedSlugs,
      est_quantity: d.estQuantity ?? null,
      timeline: d.timeline ?? null,
      notes: d.notes ?? null,
    });
    if (error) throw new Error(`sample request insert failed: ${error.message}`);

    await notifyOps(
      `Sample kit request — ${d.companyName}`,
      `<p><strong>${esc(d.contactName)}</strong> (${esc(d.roleTitle || "—")}) at <strong>${esc(d.companyName)}</strong> requested a sample kit.</p>
       <p>Email: ${esc(d.contactEmail)}<br/>Interested in: ${esc(d.interestedSlugs.join(", ") || "—")}<br/>Est. quantity: ${esc(d.estQuantity || "—")} · Timeline: ${esc(d.timeline || "—")}</p>
       <p>Ship to: ${esc([d.shipTo.line1, d.shipTo.line2, d.shipTo.city, d.shipTo.state, d.shipTo.postalCode, d.shipTo.country].filter(Boolean).join(", "))}</p>
       ${d.notes ? `<p>Notes: ${esc(d.notes)}</p>` : ""}`
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, { fallback: "Couldn't submit the request. Please try again.", status: 400 });
  }
}
