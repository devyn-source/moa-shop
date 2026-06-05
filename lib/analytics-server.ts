// Server-side events (purchase, proof approval) — fired from route handlers/webhooks.
// Goes to Vercel Analytics + PostHog (server capture) when configured.
import { track as vercelTrack } from "@vercel/analytics/server";

const PH_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || process.env.POSTHOG_API_KEY;
const PH_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

export async function trackServer(
  event: string,
  props: Record<string, string | number | boolean> = {},
  distinctId?: string
): Promise<void> {
  try { await vercelTrack(event, props); } catch { /* not in request context / no flag */ }
  if (PH_KEY) {
    try {
      await fetch(`${PH_HOST}/capture/`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          api_key: PH_KEY,
          event,
          properties: { ...props, $lib: "moa-shop-server" },
          distinct_id: distinctId || String(props.order_number ?? props.order_id ?? "server"),
        }),
      });
    } catch { /* swallow — analytics must never break the order flow */ }
  }
}
