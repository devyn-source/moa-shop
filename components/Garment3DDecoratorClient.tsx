"use client";

import dynamic from "next/dynamic";
import type { DecalCapture, Zone } from "./Garment3DDecorator";

const Garment3DDecorator = dynamic(() => import("./Garment3DDecorator"), {
  ssr: false,
  loading: () => <div className="g3d-loading">Preparing 3D…</div>,
});

export default function Garment3DDecoratorClient(props: {
  url: string;
  artUrl: string;
  hex?: string;
  zones: Zone[];
  onChange?: (c: DecalCapture) => void;
}) {
  return <Garment3DDecorator {...props} />;
}
