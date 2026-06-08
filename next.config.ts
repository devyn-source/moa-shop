import type { NextConfig } from "next";

// Content-Security-Policy — started in Report-Only so it can't break the live
// site; allowlists the third parties we load (Clerk, Stripe, Supabase, analytics).
// Validate in the browser console, then flip to enforcing `Content-Security-Policy`.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://*.clerk.com https://js.stripe.com https://*.posthog.com https://www.googletagmanager.com https://www.google-analytics.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://*.clerk.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://*.clerk.accounts.dev https://*.clerk.com https://api.stripe.com https://*.posthog.com https://www.google-analytics.com",
  "frame-src https://js.stripe.com https://*.clerk.com",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'"
].join("; ");

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY }
];

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false, // don't ship source maps to the browser
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ntppmyydbmwweosuavuw.supabase.co",
        pathname: "/storage/v1/object/**" // public + signed object paths
      }
    ]
  },
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      // Private surfaces must never be indexed.
      { source: "/orders/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/adjust/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }
    ];
  }
};

export default nextConfig;
