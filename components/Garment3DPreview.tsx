"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Html } from "@react-three/drei";
import { PreviewBackdrop, type Placement } from "./Garment3DDecorator";

// The garment with the buyer's placed artwork projected onto the surface,
// rotatable. Used on every NON-placement step (color, fabric, decoration, size)
// so the design stays visible after leaving the Studio editor.
export default function Garment3DPreview({
  url,
  hex = "#C9C4B8",
  artUrl,
  placements,
}: {
  url: string;
  hex?: string;
  artUrl: string;
  placements: Placement[];
}) {
  return (
    <div className="g3d">
      <div className="g3d-stage">
        <Canvas flat shadows camera={{ position: [0, 0.2, 3.2], fov: 35 }} dpr={[1, 2]} gl={{ antialias: true, preserveDrawingBuffer: true }}>
          <color attach="background" args={["#EEEAE3"]} />
          <ambientLight intensity={0.6} />
          <hemisphereLight args={["#ffffff", "#d8d2c8", 0.3]} />
          <directionalLight position={[3, 5, 4]} intensity={0.95} castShadow shadow-mapSize={[2048, 2048]} />
          <directionalLight position={[-4, 2, -2]} intensity={0.3} />
          <Suspense fallback={<Html center>Loading…</Html>}>
            <PreviewBackdrop url={url} hex={hex} artUrl={artUrl} placements={placements} />
            <ContactShadows position={[0, -0.8, 0]} opacity={0.28} scale={4} blur={2.6} far={2.5} />
          </Suspense>
          <OrbitControls enablePan={false} enableZoom={false} minPolarAngle={Math.PI * 0.32} maxPolarAngle={Math.PI * 0.6} enableDamping dampingFactor={0.08} />
        </Canvas>
      </div>
    </div>
  );
}
