"use client";

import { useEffect, useRef, useState } from "react";

const SAMPLE_ART =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 90"><text x="120" y="66" font-family="Arial, sans-serif" font-size="60" font-weight="800" letter-spacing="2" text-anchor="middle" fill="#ffffff">MOA</text></svg>`
  );

const SWATCHES = [
  { label: "Original", value: "" },
  { label: "Bone", value: "#e7dfcf" },
  { label: "Sand", value: "#c8b79a" },
  { label: "Olive", value: "#4b4a2f" },
  { label: "Navy", value: "#1d2a40" },
  { label: "Burgundy", value: "#5a1f25" },
  { label: "Forest", value: "#26402f" },
  { label: "Black", value: "#141414" }
];

const BLENDS = ["multiply", "screen", "normal"] as const;
type Blend = (typeof BLENDS)[number];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

type Mode = "move" | "scale" | "rotate";

export function StudioPreview({ defaultBase }: { defaultBase: string }) {
  const [base, setBase] = useState(defaultBase);
  const [art, setArt] = useState(SAMPLE_ART);
  const [aspect, setAspect] = useState(90 / 240); // h / w
  const [pos, setPos] = useState({ x: 50, y: 42 }); // center %
  const [scale, setScale] = useState(24); // width as % of stage
  const [rot, setRot] = useState(0);
  const [color, setColor] = useState("");
  const [blend, setBlend] = useState<Blend>("screen");
  const [controls, setControls] = useState(true);
  const [stage, setStage] = useState({ w: 0, h: 0 });

  const stageRef = useRef<HTMLDivElement>(null);
  const baseInput = useRef<HTMLInputElement>(null);
  const artInput = useRef<HTMLInputElement>(null);
  const drag = useRef<null | {
    mode: Mode;
    startPx: { x: number; y: number };
    startPos: { x: number; y: number };
    startScale: number;
    startRot: number;
    startDist: number;
    angleOffset: number;
  }>(null);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStage({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setStage({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) setAspect(img.naturalHeight / img.naturalWidth);
    };
    img.src = art;
  }, [art]);

  function rect() {
    return stageRef.current!.getBoundingClientRect();
  }

  function down(mode: Mode) {
    return (event: React.PointerEvent) => {
      event.stopPropagation();
      const r = rect();
      const ptr = { x: event.clientX - r.left, y: event.clientY - r.top };
      const centerPx = { x: (pos.x / 100) * r.width, y: (pos.y / 100) * r.height };
      const dist = Math.hypot(ptr.x - centerPx.x, ptr.y - centerPx.y);
      const ang = Math.atan2(ptr.y - centerPx.y, ptr.x - centerPx.x);
      drag.current = {
        mode,
        startPx: ptr,
        startPos: { ...pos },
        startScale: scale,
        startRot: rot,
        startDist: dist,
        angleOffset: ang - (rot * Math.PI) / 180
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    };
  }

  function move(event: React.PointerEvent) {
    const it = drag.current;
    if (!it) return;
    const r = rect();
    const ptr = { x: event.clientX - r.left, y: event.clientY - r.top };
    const centerPx = { x: (it.startPos.x / 100) * r.width, y: (it.startPos.y / 100) * r.height };

    if (it.mode === "move") {
      const dx = ((ptr.x - it.startPx.x) / r.width) * 100;
      const dy = ((ptr.y - it.startPx.y) / r.height) * 100;
      setPos({ x: clamp(it.startPos.x + dx, 0, 100), y: clamp(it.startPos.y + dy, 0, 100) });
    } else if (it.mode === "scale") {
      const dist = Math.hypot(ptr.x - centerPx.x, ptr.y - centerPx.y);
      const ratio = it.startDist > 0 ? dist / it.startDist : 1;
      setScale(clamp(it.startScale * ratio, 4, 95));
    } else if (it.mode === "rotate") {
      const ang = Math.atan2(ptr.y - centerPx.y, ptr.x - centerPx.x);
      setRot(((ang - it.angleOffset) * 180) / Math.PI);
    }
  }

  function up(event: React.PointerEvent) {
    drag.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  }

  function onUpload(setter: (url: string) => void) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) setter(URL.createObjectURL(file));
    };
  }

  const boxW = (scale / 100) * stage.w;
  const boxH = boxW * aspect;

  const maskStyle = {
    WebkitMaskImage: `url("${base}")`,
    maskImage: `url("${base}")`,
    WebkitMaskSize: "contain",
    maskSize: "contain",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center"
  } as const;

  return (
    <div className="studio">
      <div className="studio-stage" ref={stageRef}>
        <img className="studio-base" src={base} alt="Garment base" />
        {color ? <div className="studio-layer studio-recolor" style={{ ...maskStyle, background: color }} /> : null}

        <div
          className={`studio-tbox${controls ? " studio-tbox--on" : ""}`}
          style={{
            left: `${pos.x}%`,
            top: `${pos.y}%`,
            width: `${boxW}px`,
            height: `${boxH}px`,
            transform: `translate(-50%, -50%) rotate(${rot}deg)`
          }}
          onPointerDown={down("move")}
          onPointerMove={move}
          onPointerUp={up}
        >
          <img className="studio-tbox-art" src={art} alt="Artwork" draggable={false} style={{ mixBlendMode: blend }} />
          {controls ? (
            <>
              <button type="button" className="tbox-handle tbox-handle--tl" onPointerDown={down("scale")} onPointerMove={move} onPointerUp={up} aria-label="Resize" />
              <button type="button" className="tbox-handle tbox-handle--tr" onPointerDown={down("scale")} onPointerMove={move} onPointerUp={up} aria-label="Resize" />
              <button type="button" className="tbox-handle tbox-handle--br" onPointerDown={down("scale")} onPointerMove={move} onPointerUp={up} aria-label="Resize" />
              <button type="button" className="tbox-handle tbox-handle--bl" onPointerDown={down("scale")} onPointerMove={move} onPointerUp={up} aria-label="Resize" />
              <button type="button" className="tbox-rotate" onPointerDown={down("rotate")} onPointerMove={move} onPointerUp={up} aria-label="Rotate" />
            </>
          ) : null}
        </div>
      </div>

      <div className="studio-controls panel">
        <div className="panel-pad">
          <p className="eyebrow">Design studio · prototype</p>

          <div className="studio-group">
            <label className="studio-check">
              <input type="checkbox" checked={controls} onChange={(e) => setControls(e.target.checked)} />
              <span>Show transform handles (drag to move · corners resize · top dot rotates)</span>
            </label>
          </div>

          <div className="studio-group">
            <span className="label">Graphic size · {Math.round(scale)}%</span>
            <input type="range" min={4} max={80} value={Math.round(scale)} onChange={(e) => setScale(Number(e.target.value))} />
          </div>

          <div className="studio-group">
            <span className="label">Rotation · {Math.round(rot)}°</span>
            <input type="range" min={-45} max={45} value={Math.round(rot)} onChange={(e) => setRot(Number(e.target.value))} />
          </div>

          <div className="studio-group">
            <span className="label">Artwork blend</span>
            <div className="studio-seg">
              {BLENDS.map((b) => (
                <button key={b} type="button" className={`studio-seg-btn${blend === b ? " studio-seg-btn--active" : ""}`} onClick={() => setBlend(b)}>
                  {b}
                </button>
              ))}
            </div>
            <p className="trust-note">Light garment → multiply (sinks into folds). Dark garment → screen. Flat decal → normal.</p>
          </div>

          <div className="studio-group">
            <span className="label">Garment color</span>
            <div className="studio-swatches">
              {SWATCHES.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  title={s.label}
                  className={`studio-swatch${color === s.value ? " studio-swatch--active" : ""}${s.value === "" ? " studio-swatch--none" : ""}`}
                  style={s.value ? { background: s.value } : undefined}
                  onClick={() => setColor(s.value)}
                >
                  {s.value === "" ? "○" : ""}
                </button>
              ))}
            </div>
            <p className="trust-note">Recolor needs a light/grey base — upload one below.</p>
          </div>

          <div className="studio-group studio-uploads">
            <button type="button" className="secondary-button" onClick={() => baseInput.current?.click()}>Upload garment base</button>
            <button type="button" className="secondary-button" onClick={() => artInput.current?.click()}>Upload artwork</button>
            <input ref={baseInput} type="file" accept="image/png,image/webp" hidden onChange={onUpload(setBase)} />
            <input ref={artInput} type="file" accept="image/png,image/svg+xml,image/webp" hidden onChange={onUpload(setArt)} />
          </div>
        </div>
      </div>
    </div>
  );
}
