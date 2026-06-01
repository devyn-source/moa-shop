"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Free positioning of artwork INSIDE a fixed bounding box.
//
// `transform` is expressed as fractions of the bounding box (0..1):
//   ox, oy = artwork top-left relative to the box's top-left
//   sx, sy = artwork width/height as a fraction of the box dimensions
//
// All four values stay clamped so the artwork can never escape its zone —
// the zone (authored in /admin/zones) remains the hard constraint while the
// shopper places + sizes within it.

export type ArtTransform = { ox: number; oy: number; sx: number; sy: number; r?: number };

type DragMode = "move" | "nw" | "ne" | "sw" | "se" | "rotate";
type DragState = {
  mode: DragMode;
  startX: number;
  startY: number;
  origin: ArtTransform;
  width: number;
  height: number;
  centerX?: number; // for rotate (parent-box-relative px)
  centerY?: number;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const MIN = 0.08; // smallest artwork edge (fraction of box)

function applyDrag(state: DragState, x: number, y: number): ArtTransform {
  const dx = (x - state.startX) / state.width;
  const dy = (y - state.startY) / state.height;
  const o = state.origin;
  if (state.mode === "rotate") {
    const cx = state.centerX ?? 0;
    const cy = state.centerY ?? 0;
    const angle = (Math.atan2(y - cy, x - cx) * 180) / Math.PI + 90;
    const normalised = ((angle % 360) + 360) % 360;
    return { ...o, r: Math.round(normalised) };
  }
  if (state.mode === "move") {
    return {
      ...o,
      ox: clamp(o.ox + dx, 0, 1 - o.sx),
      oy: clamp(o.oy + dy, 0, 1 - o.sy)
    };
  }
  let x0 = o.ox;
  let y0 = o.oy;
  let x1 = o.ox + o.sx;
  let y1 = o.oy + o.sy;
  if (state.mode === "nw" || state.mode === "sw") x0 = clamp(o.ox + dx, 0, x1 - MIN);
  if (state.mode === "ne" || state.mode === "se") x1 = clamp(o.ox + o.sx + dx, x0 + MIN, 1);
  if (state.mode === "nw" || state.mode === "ne") y0 = clamp(o.oy + dy, 0, y1 - MIN);
  if (state.mode === "sw" || state.mode === "se") y1 = clamp(o.oy + o.sy + dy, y0 + MIN, 1);
  return { ox: x0, oy: y0, sx: x1 - x0, sy: y1 - y0 };
}

export function DraggableArt({
  url,
  transform,
  onChange
}: {
  url: string;
  transform: ArtTransform;
  onChange: (t: ArtTransform) => void;
}) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      // Parent of wrap is the bounding box; use its rect for percent math.
      const box = wrapRef.current?.parentElement?.getBoundingClientRect();
      if (!box) return;
      onChange(applyDrag(drag, e.clientX - box.left, e.clientY - box.top));
    };
    const onUp = () => setDrag(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, onChange]);

  const start = useCallback(
    (mode: DragMode) => (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const box = wrapRef.current?.parentElement?.getBoundingClientRect();
      if (!box) return;
      const next: DragState = {
        mode,
        startX: e.clientX - box.left,
        startY: e.clientY - box.top,
        origin: { ...transform },
        width: box.width,
        height: box.height
      };
      if (mode === "rotate") {
        next.centerX = (transform.ox + transform.sx / 2) * box.width;
        next.centerY = (transform.oy + transform.sy / 2) * box.height;
      }
      setDrag(next);
    },
    [transform]
  );

  const dragging = Boolean(drag);
  const showHandles = hover || dragging;

  // Arrow keys nudge the artwork while the handle is hovered/focused —
  // 1% per tap, 5% with Shift, clamped inside the box.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.05 : 0.01;
    let next: ArtTransform | null = null;
    if (e.key === "ArrowLeft")
      next = { ...transform, ox: clamp(transform.ox - step, 0, 1 - transform.sx) };
    else if (e.key === "ArrowRight")
      next = { ...transform, ox: clamp(transform.ox + step, 0, 1 - transform.sx) };
    else if (e.key === "ArrowUp")
      next = { ...transform, oy: clamp(transform.oy - step, 0, 1 - transform.sy) };
    else if (e.key === "ArrowDown")
      next = { ...transform, oy: clamp(transform.oy + step, 0, 1 - transform.sy) };
    if (next) {
      e.preventDefault();
      onChange(next);
    }
  };

  return (
    <span
      ref={wrapRef}
      tabIndex={0}
      role="button"
      aria-label="Artwork — drag to move, corners to resize, top handle to rotate, arrow keys to nudge"
      className={`pdpx-art-handle${showHandles ? " is-on" : ""}`}
      style={{
        left: `${transform.ox * 100}%`,
        top: `${transform.oy * 100}%`,
        width: `${transform.sx * 100}%`,
        height: `${transform.sy * 100}%`,
        transform: `rotate(${transform.r ?? 0}deg)`,
        transformOrigin: "center center",
        backgroundImage: `url("${url}")`
      }}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onPointerDown={start("move")}
      onKeyDown={onKeyDown}
    >
      <span className="pdpx-art-handle__edge" />
      <span className="pdpx-art-resize pdpx-art-resize--nw" onPointerDown={start("nw")} />
      <span className="pdpx-art-resize pdpx-art-resize--ne" onPointerDown={start("ne")} />
      <span className="pdpx-art-resize pdpx-art-resize--sw" onPointerDown={start("sw")} />
      <span className="pdpx-art-resize pdpx-art-resize--se" onPointerDown={start("se")} />
      <span className="pdpx-art-rotate-stem" />
      <span
        className="pdpx-art-rotate"
        onPointerDown={start("rotate")}
        title="Rotate"
      />
    </span>
  );
}
