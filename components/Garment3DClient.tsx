"use client";

import dynamic from "next/dynamic";
import { Garment3DSkeleton } from "./Garment3DSkeleton";

// WebGL must not SSR — load the canvas client-only.
const Garment3D = dynamic(() => import("./Garment3D"), {
  ssr: false,
  loading: () => <Garment3DSkeleton />,
});

export default function Garment3DClient(props: {
  url: string;
  swatches?: { label: string; hex: string }[];
  hex?: string;
  showSwatches?: boolean;
  fit?: number;
  showShadow?: boolean;
}) {
  return <Garment3D {...props} />;
}
