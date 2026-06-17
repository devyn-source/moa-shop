import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_ORIGIN || "https://shop.magnumopus.agency";

const DISALLOW = ["/admin", "/api/", "/adjust/", "/orders", "/cart", "/checkout", "/sign-in", "/login", "/studio-3d", "/studio-decal", "/c/"];
// AI answer-engine crawlers — explicitly welcomed so MOA can be read + cited
// in ChatGPT, Perplexity, Google AI Overviews, Claude, Gemini, etc. (GEO).
const AI_BOTS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-Web", "anthropic-ai",
  "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "cohere-ai", "Amazonbot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      ...AI_BOTS.map((bot) => ({ userAgent: bot, allow: "/", disallow: DISALLOW })),
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
