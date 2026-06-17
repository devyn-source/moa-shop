"use client";

import dynamic from "next/dynamic";
import type { Placement } from "./Garment3DDecorator";

const Garment3DPreview = dynamic(() => import("./Garment3DPreview"), {
  ssr: false,
  loading: () => <div className="g3d-loading">Preparing 3D…</div>,
});

export default function Garment3DPreviewClient(props: { url: string; hex?: string; artUrl: string; placements: Placement[] }) {
  return <Garment3DPreview {...props} />;
}
