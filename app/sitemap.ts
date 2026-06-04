import type { MetadataRoute } from "next";
import { getProducts } from "@/lib/store";

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
    { url: `${BASE}/catalog-pdf`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/refund-policy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    ...productUrls,
  ];
}
