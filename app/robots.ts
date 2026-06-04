import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_ORIGIN || "https://shop.magnumopus.agency";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep private/transactional + token routes out of the index.
      disallow: ["/admin", "/api/", "/adjust/", "/orders", "/cart", "/checkout", "/sign-in", "/login"],
    },
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
