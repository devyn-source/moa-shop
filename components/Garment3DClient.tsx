"use client";

import dynamic from "next/dynamic";

// WebGL must not SSR — load the canvas client-only.
const Garment3D = dynamic(() => import("./Garment3D"), {
  ssr: false,
  loading: () => <div className="g3d-loading">Preparing 3D…</div>,
});

export default function Garment3DClient(props: { url: string; swatches: { label: string; hex: string }[] }) {
  return <Garment3D {...props} />;
}
