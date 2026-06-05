"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import posthog from "posthog-js";
import { trackPageView } from "@/lib/analytics";

// Vercel Analytics + Speed Insights are always on (no key). PostHog and GA4
// initialize only when their env key is present — so the funnel layer is one
// key away from full product analytics.
export function AnalyticsProviders() {
  const pathname = usePathname();

  // Owned pageview into analytics_events on every route change.
  useEffect(() => {
    if (pathname) trackPageView(pathname);
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as Record<string, unknown>;

    const phKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (phKey && !w.__phInit) {
      w.__phInit = true;
      posthog.init(phKey, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
        capture_pageview: true,
        capture_pageleave: true,
        autocapture: true,
        persistence: "localStorage+cookie",
      });
      w.posthog = posthog;
    }

    const gaId = process.env.NEXT_PUBLIC_GA_ID;
    if (gaId && !w.__gaInit) {
      w.__gaInit = true;
      const s = document.createElement("script");
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
      document.head.appendChild(s);
      w.dataLayer = (w.dataLayer as unknown[]) || [];
      const gtag = (...args: unknown[]) => (w.dataLayer as unknown[]).push(args);
      w.gtag = gtag;
      gtag("js", new Date());
      gtag("config", gaId);
    }
  }, []);

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
