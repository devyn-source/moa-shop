"use client";

// Single client-side event layer. Every call fans out to whatever is configured:
// Vercel Analytics (always on, no key) + PostHog + GA4 (the moment a key is set).
// PostHog autocapture also records granular clicks/pageviews automatically — these
// named events are the SEMANTIC ecommerce funnel (Shopify-style).
import { track as vercelTrack } from "@vercel/analytics";

type Val = string | number | boolean | null | undefined;
type Props = Record<string, Val>;

function clean(props: Props): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(props)) if (v !== null && v !== undefined) out[k] = v as string | number | boolean;
  return out;
}

// Persistent anon id (localStorage) + per-tab session id (sessionStorage) so the
// owned event stream supports sessions, funnels, and visitor counts.
function ids(): { session_id: string | null; anon_id: string | null } {
  if (typeof window === "undefined") return { session_id: null, anon_id: null };
  try {
    let anon = localStorage.getItem("moa_anon");
    if (!anon) { anon = crypto.randomUUID(); localStorage.setItem("moa_anon", anon); }
    let sess = sessionStorage.getItem("moa_sess");
    if (!sess) { sess = crypto.randomUUID(); sessionStorage.setItem("moa_sess", sess); }
    return { session_id: sess, anon_id: anon };
  } catch { return { session_id: null, anon_id: null }; }
}

// Fire-and-forget into MOA's own /api/track → analytics_events (the source the
// MoaOS dashboard reads). Beacon survives navigation; never throws.
function ingest(event: string, p: Record<string, string | number | boolean>) {
  if (typeof window === "undefined") return;
  try {
    const { session_id, anon_id } = ids();
    const body = JSON.stringify({
      event, props: p, session_id, anon_id,
      path: location.pathname,
      slug: typeof p.slug === "string" ? p.slug : null,
      value: typeof p.value === "number" ? p.value : null,
      referrer: document.referrer || null,
    });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
    else fetch("/api/track", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true });
  } catch {}
}

function fan(event: string, props: Props = {}) {
  const p = clean(props);
  try { vercelTrack(event, p); } catch {}
  ingest(event, p);
  if (typeof window !== "undefined") {
    const w = window as unknown as { posthog?: { capture?: (e: string, p: object) => void }; gtag?: (...a: unknown[]) => void };
    try { w.posthog?.capture?.(event, p); } catch {}
    try { w.gtag?.("event", event, p); } catch {}
  }
}

// Page view → owned table only (Vercel/PostHog auto-track their own pageviews).
export function trackPageView(path: string) {
  ingest("page_view", { path });
}

// Shopify/GA4-style ecommerce funnel + MOA custom events.
export const analytics = {
  productViewed: (p: Props) => fan("product_viewed", p),
  variantSelected: (p: Props) => fan("variant_selected", p),
  decorationSelected: (p: Props) => fan("decoration_selected", p),
  placementSelected: (p: Props) => fan("placement_selected", p),
  artworkUploaded: (p: Props) => fan("artwork_uploaded", p),
  configureStep: (p: Props) => fan("configure_step", p),
  addToCart: (p: Props) => fan("add_to_cart", p),
  viewCart: (p: Props) => fan("view_cart", p),
  beginCheckout: (p: Props) => fan("begin_checkout", p),
  checkoutSubmitted: (p: Props) => fan("checkout_submitted", p),
  proofViewed: (p: Props) => fan("proof_viewed", p),
  proofApproved: (p: Props) => fan("proof_approved", p),
  track: fan,
};
