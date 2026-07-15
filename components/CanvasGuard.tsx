"use client";

import { useCallback, useState } from "react";

// WebGL context-loss recovery for the 3D stages. Browsers reclaim WebGL
// contexts under GPU pressure (many tabs, old hardware); without handling,
// the garment silently disappears and the stage stays blank cream forever.
// Usage:
//   const guard = useCanvasGuard();
//   <Canvas key={guard.key} onCreated={guard.onCreated}>…</Canvas>
//   {guard.lost ? <CanvasLostOverlay onReload={guard.reload} /> : null}
export function useCanvasGuard() {
  const [lost, setLost] = useState(false);
  const [key, setKey] = useState(0);

  const onCreated = useCallback((state: { gl: { domElement: HTMLCanvasElement } }) => {
    const el = state.gl.domElement;
    el.addEventListener(
      "webglcontextlost",
      (e) => {
        // preventDefault signals we intend to restore; some browsers then fire
        // webglcontextrestored on their own. Either way, surface the reload UI.
        e.preventDefault();
        setLost(true);
      },
      false
    );
    el.addEventListener("webglcontextrestored", () => setLost(false), false);
  }, []);

  const reload = useCallback(() => {
    // Remount the <Canvas> tree entirely — a fresh context, fresh scene.
    setLost(false);
    setKey((k) => k + 1);
  }, []);

  return { lost, key, onCreated, reload };
}

export function CanvasLostOverlay({ onReload }: { onReload: () => void }) {
  return (
    <div className="g3d-lost" role="alert">
      <p className="g3d-lost-msg">The 3D view paused to free up memory.</p>
      <button type="button" className="g3d-lost-btn" onClick={onReload}>
        Reload 3D view
      </button>
    </div>
  );
}
