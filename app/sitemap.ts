import type { MetadataRoute } from "next";
import { getProducts } from "@/lib/store";
import { USE_CASES } from "@/lib/use-cases";

const BASE = process.env.NEXT_PUBLIC_SITE_ORIGIN || "https://shop.magnumopus.agency";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let productUrls: MetadataRoute.Sitemap = [];
  try {
    const products = await getProducts();
    productUrls = products
      .filter((p) => p.isPublished)
      .map((p) => ({ url: `${BASE}/p/${p.slug}`, changeFrequency: "weekly" as const, priority: 0.8 }));
  } catch {
    /* sitemap still renders the static routes */
  }

  return [
    { url: BASE, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/shop`, changeFrequency: "weekly", priority: 0.9 },
    ...USE_CASES.map((uc) => ({ url: `${BASE}/for/${uc.slug}`, changeFrequency: "monthly" as const, priority: 0.7 })),
    { url: `${BASE}/faq`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/samples`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/refund-policy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/shipping`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    ...productUrls,
  ];
}
