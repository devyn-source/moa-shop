"use client";

import dynamic from "next/dynamic";
import type { Placement } from "./Garment3DDecorator";
import { Garment3DSkeleton } from "./Garment3DSkeleton";

const Garment3DPreview = dynamic(() => import("./Garment3DPreview"), {
  ssr: false,
  loading: () => <Garment3DSkeleton />,
});

export default function Garment3DPreviewClient(props: { url: string; hex?: string; artUrl: string; placements: Placement[] }) {
  return <Garment3DPreview {...props} />;
}
