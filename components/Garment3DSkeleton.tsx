// Branded placeholder shown while a 3D chunk downloads or a GLB streams in —
// a soft pulsing garment silhouette on cream instead of an empty stage.
// `inCanvas` renders the compact fixed-size variant for use inside a
// react-three-fiber <Html> Suspense fallback (percent widths collapse there).
export function Garment3DSkeleton({ inCanvas = false }: { inCanvas?: boolean }) {
  return (
    <div className={`g3d-skel${inCanvas ? " g3d-skel--canvas" : ""}`} role="status">
      <span className="g3d-skel-shape" aria-hidden />
      <span className="g3d-skel-caption">Preparing 3D view…</span>
    </div>
  );
}
