"use client";

import dynamic from "next/dynamic";

const Model3DCalibrator = dynamic(() => import("./Model3DCalibrator"), {
  ssr: false,
  loading: () => <div className="m3dcal"><p className="m3dcal-empty">Loading 3D calibration…</p></div>,
});

export default function Model3DCalibratorClient(props: { slug: string; hasModel: boolean; modelUrl: string | null }) {
  return <Model3DCalibrator {...props} />;
}
