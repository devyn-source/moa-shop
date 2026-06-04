import { ImageResponse } from "next/og";

// Site-wide social card — the MOA wordmark on cream, 1200×630. Used for link
// previews on social + chat. (Product pages set their own product-photo card.)
export const runtime = "edge";
export const alt = "MOA Catalog — Production-grade merch, made to order by Magnum Opus Agency";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SITE = process.env.NEXT_PUBLIC_SITE_ORIGIN || "https://shop.magnumopus.agency";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#EEEAE3",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${SITE}/brand/logos/moa-logo.png`} width={640} alt="MOA · Magnum Opus" />
      </div>
    ),
    { ...size }
  );
}
