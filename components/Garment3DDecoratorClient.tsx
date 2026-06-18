"use client";

import dynamic from "next/dynamic";
import type { Model3DCalibration } from "@/lib/zones";
import type { StudioCapture, Zone, Placement } from "./Garment3DDecorator";

const Garment3DDecorator = dynamic(() => import("./Garment3DDecorator"), {
  ssr: false,
  loading: () => <div className="g3d-loading">Preparing 3D…</div>,
});

export default function Garment3DDecoratorClient(props: {
  url: string;
  artUrl: string;
  hex?: string;
  zones: Zone[];
  backZones?: Zone[];
  artPxWidth?: number;
  garmentRefWidthIn?: number;
  model3d?: Model3DCalibration | null;
  method?: string;
  initialPlacements?: Placement[];
  onChange?: (c: StudioCapture[]) => void;
}) {
  return <Garment3DDecorator {...props} />;
}
