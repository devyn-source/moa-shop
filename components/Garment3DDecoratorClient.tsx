"use client";

import dynamic from "next/dynamic";
import type { Model3DCalibration } from "@/lib/zones";
import type { StudioCapture, Zone, Placement } from "./Garment3DDecorator";
import { Garment3DSkeleton } from "./Garment3DSkeleton";

const Garment3DDecorator = dynamic(() => import("./Garment3DDecorator"), {
  ssr: false,
  loading: () => <Garment3DSkeleton />,
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
  preset?: { key: string; view: "front" | "back"; zoneId: string; widthIn: number; belowHpsIn: number; fromCfIn: number } | null;
  hideZoneChips?: boolean;
  onChange?: (c: StudioCapture[]) => void;
}) {
  return <Garment3DDecorator {...props} />;
}
