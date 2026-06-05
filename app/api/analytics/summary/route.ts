import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getProducts } from "@/lib/store";

// Full analytics summary for the MoaOS catalog dashboard. Computes every valuable
// metric from owned data: orders (revenue/units/SKU/margin/status) + analytics_events
// (sessions/funnel/conversion). Secured by the shared MOAOS_INTAKE_SECRET.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RANGES: Record<string, number | null> = { "7d": 7, "30d": 30, "90d": 90, "365d": 365, all: null };

function authed(req: Request): boolean {
  // Accept any of the shared secrets MOA already uses for cross-app calls, under
  // either header (mirrors the proven refund integration: MoaOS sends
  // x-moa-internal-secret = INTERNAL_API_SECRET). Open only if none configured.
  const secrets = [process.env.MOAOS_INTAKE_SECRET, process.env.INTERNAL_API_SECRET].filter(Boolean) as string[];
  if (!secrets.length) return true;
  const url = new URL(req.url);
  const got =
    req.headers.get("x-moa-secret") ||
    req.headers.get("x-moa-internal-secret") ||
    url.searchParams.get("key");
  return Boolean(got && secrets.includes(got));
}

const day = (iso: string) => iso.slice(0, 10);
const uniq = (xs: (string | null)[]) => new Set(xs.filter(Boolean) as string[]).size;
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

export async function GET(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const range = new URL(req.url).searchParams.get("range") || "30d";
  const days = range in RANGES ? RANGES[range] : 30;
  const sinceIso = days ? new Date(Date.now() - days * 86400_000).toISOString() : null;
  const supabase = getSupabase();

  // ---- products (id → slug/name/cost) ----
  const products = await getProducts({ includeDrafts: true }).catch(() => []);
  const pmap = new Map(products.map((p) => [p.id, { slug: p.slug, name: p.displayName, cost: p.vendorUnitCostUsd ?? 0, category: p.category }]));

  // ---- orders ----
  let oq = supabase.from("orders").select("status, created_at, data");
  if (sinceIso) oq = oq.gte("created_at", sinceIso);
  const { data: orderRows } = await oq;
  type Row = { status: string | null; created_at: string; data: Record<string, unknown> };
  const orders = (orderRows ?? []) as Row[];

  const CANCELLED = new Set(["cancelled", "canceled"]);
  let revenue = 0, units = 0, cost = 0, paidCount = 0, cancelled = 0, refunded = 0, refundValue = 0;
  const byStatus: Record<string, number> = {};
  const bySku: Record<string, { name: string; revenue: number; units: number; orders: number }> = {};
  const series: Record<string, { revenue: number; orders: number }> = {};
  const emails: Record<string, number> = {};

  for (const r of orders) {
    const d = r.data as { totalUsd?: number; quantity?: number; productId?: string; contactEmail?: string; refundedAt?: string };
    const status = r.status || "unknown";
    byStatus[status] = (byStatus[status] || 0) + 1;
    const isCancelled = CANCELLED.has(status) || Boolean(d.refundedAt);
    if (d.refundedAt) { refunded++; refundValue += d.totalUsd || 0; }
    if (isCancelled) { cancelled++; continue; }
    const total = d.totalUsd || 0;
    const qty = d.quantity || 0;
    revenue += total; units += qty; paidCount++;
    const prod = d.productId ? pmap.get(d.productId) : undefined;
    cost += (prod?.cost ?? 0) * qty;
    const skuKey = prod?.slug || d.productId || "unknown";
    const skuName = prod?.name || skuKey;
    const s = (bySku[skuKey] ||= { name: skuName, revenue: 0, units: 0, orders: 0 });
    s.revenue += total; s.units += qty; s.orders++;
    const dk = day(r.created_at);
    const t = (series[dk] ||= { revenue: 0, orders: 0 });
    t.revenue += total; t.orders++;
    if (d.contactEmail) emails[d.contactEmail.toLowerCase()] = (emails[d.contactEmail.toLowerCase()] || 0) + 1;
  }

  const returningCustomers = Object.values(emails).filter((n) => n > 1).length;
  const totalCustomers = Object.keys(emails).length;

  // ---- events ----
  let eq = supabase.from("analytics_events").select("event, session_id, anon_id, slug, created_at").order("created_at", { ascending: false }).limit(100000);
  if (sinceIso) eq = eq.gte("created_at", sinceIso);
  const { data: eventRows } = await eq;
  type Ev = { event: string; session_id: string | null; anon_id: string | null; slug: string | null; created_at: string };
  const events = (eventRows ?? []) as Ev[];

  const sessionsOf = (name: string) => uniq(events.filter((e) => e.event === name).map((e) => e.session_id));
  const countOf = (name: string) => events.filter((e) => e.event === name).length;

  const sessions = uniq(events.map((e) => e.session_id));
  const visitors = uniq(events.map((e) => e.anon_id));
  const pageviews = countOf("page_view");
  const productViewSessions = sessionsOf("product_viewed");
  const addToCartSessions = sessionsOf("add_to_cart");
  const checkoutSessions = sessionsOf("begin_checkout");

  // top viewed SKUs (by product_viewed)
  const viewBySku: Record<string, number> = {};
  for (const e of events) if (e.event === "product_viewed" && e.slug) viewBySku[e.slug] = (viewBySku[e.slug] || 0) + 1;

  const topViewed = Object.entries(viewBySku).map(([slug, views]) => ({ slug, views })).sort((a, b) => b.views - a.views).slice(0, 10);
  const topSellers = Object.entries(bySku).map(([slug, v]) => ({ slug, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const timeseries = Object.entries(series).map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    range, generatedAt: new Date().toISOString(),
    revenue: {
      gross: Math.round(revenue), aov: paidCount ? Math.round(revenue / paidCount) : 0,
      units, orders: paidCount, grossProfit: Math.round(revenue - cost),
      marginPct: revenue ? Math.round(((revenue - cost) / revenue) * 100) : 0,
    },
    orders: { total: orders.length, paid: paidCount, cancelled, refunded, refundValue: Math.round(refundValue), byStatus },
    customers: { total: totalCustomers, returning: returningCustomers, repeatRatePct: pct(returningCustomers, totalCustomers) },
    funnel: {
      visitors, sessions, pageviews,
      productViews: countOf("product_viewed"), productViewSessions,
      addToCart: countOf("add_to_cart"), addToCartSessions,
      beginCheckout: countOf("begin_checkout"), checkoutSessions,
      checkoutSubmitted: countOf("checkout_submitted"),
      purchases: paidCount,
      proofApproved: countOf("proof_approved"),
      // session-based conversion through the funnel
      viewRatePct: pct(productViewSessions, sessions),
      cartRatePct: pct(addToCartSessions, productViewSessions),
      checkoutRatePct: pct(checkoutSessions, addToCartSessions),
      conversionRatePct: pct(paidCount, sessions),
      cartAbandonmentPct: checkoutSessions ? pct(checkoutSessions - paidCount, checkoutSessions) : 0,
    },
    topViewed, topSellers, timeseries,
  });
}
