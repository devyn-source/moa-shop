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

function fan(event: string, props: Props = {}) {
  const p = clean(props);
  try { vercelTrack(event, p); } catch {}
  if (typeof window !== "undefined") {
    const w = window as unknown as { posthog?: { capture?: (e: string, p: object) => void }; gtag?: (...a: unknown[]) => void };
    try { w.posthog?.capture?.(event, p); } catch {}
    try { w.gtag?.("event", event, p); } catch {}
  }
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
