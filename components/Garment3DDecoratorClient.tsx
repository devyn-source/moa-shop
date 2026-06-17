"use client";

import dynamic from "next/dynamic";

const Garment3DDecorator = dynamic(() => import("./Garment3DDecorator"), {
  ssr: false,
  loading: () => <div className="g3d-loading">Preparing 3D…</div>,
});

export default function Garment3DDecoratorClient(props: { url: string; artUrl: string; hex?: string }) {
  return <Garment3DDecorator {...props} />;
}
