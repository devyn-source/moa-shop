"use client";

import { useRef, useState } from "react";

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

// Placement zones as allowed center-ranges (% of the stage) + a default graphic size.
const ZONES = {
  "left-chest": { label: "Left chest", x0: 54, x1: 63, y0: 30, y1: 37, size: 11 },
  "center-chest": { label: "Center chest", x0: 42, x1: 58, y0: 33, y1: 52, size: 26 },
  "full-front": { label: "Full front", x0: 36, x1: 64, y0: 36, y1: 64, size: 46 }
} as const;
type ZoneKey = keyof typeof ZONES;

export function StudioPreview({ defaultBase }: { defaultBase: string }) {
  const [base, setBase] = useState(defaultBase);
  const [art, setArt] = useState(SAMPLE_ART);
  const [color, setColor] = useState("");
  const [blend, setBlend] = useState<Blend>("screen");
  const [zone, setZone] = useState<ZoneKey>("center-chest");
  const [size, setSize] = useState<number>(ZONES["center-chest"].size);
  const [center, setCenter] = useState({ x: 50, y: 42 });

  const stageRef = useRef<HTMLDivElement>(null);
  const baseInput = useRef<HTMLInputElement>(null);
  const artInput = useRef<HTMLInputElement>(null);
  const dragging = useRef(false);

  function clampToZone(x: number, y: number, z: ZoneKey) {
    const r = ZONES[z];
    return { x: Math.min(r.x1, Math.max(r.x0, x)), y: Math.min(r.y1, Math.max(r.y0, y)) };
  }

  function selectZone(z: ZoneKey) {
    setZone(z);
    setSize(ZONES[z].size);
    const r = ZONES[z];
    setCenter({ x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 });
  }

  function onPointerDown(event: React.PointerEvent) {
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!dragging.current || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setCenter(clampToZone(x, y, zone));
  }

  function onPointerUp(event: React.PointerEvent) {
    dragging.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function onUpload(setter: (url: string) => void) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) setter(URL.createObjectURL(file));
    };
  }

  const z = ZONES[zone];
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
        {color ? (
          <div className="studio-layer studio-recolor" style={{ ...maskStyle, background: color }} />
        ) : null}

        {/* allowed print zone */}
        <div
          className="studio-zone"
          style={{ left: `${z.x0}%`, top: `${z.y0}%`, width: `${z.x1 - z.x0}%`, height: `${z.y1 - z.y0}%` }}
        >
          <span className="studio-zone-tag">{z.label}</span>
        </div>

        {/* draggable artwork */}
        <img
          className="studio-art-img"
          src={art}
          alt="Artwork"
          draggable={false}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{
            left: `${center.x}%`,
            top: `${center.y}%`,
            width: `${size}%`,
            transform: "translate(-50%, -50%)",
            mixBlendMode: blend
          }}
        />
      </div>

      <div className="studio-controls panel">
        <div className="panel-pad">
          <p className="eyebrow">Design studio · prototype</p>

          <div className="studio-group">
            <span className="label">Placement zone</span>
            <div className="studio-seg studio-seg--wrap">
              {(Object.keys(ZONES) as ZoneKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`studio-seg-btn${zone === key ? " studio-seg-btn--active" : ""}`}
                  onClick={() => selectZone(key)}
                >
                  {ZONES[key].label}
                </button>
              ))}
            </div>
            <p className="trust-note">Drag the artwork on the garment — it stays inside the selected zone.</p>
          </div>

          <div className="studio-group">
            <span className="label">Graphic size · {size}%</span>
            <input type="range" min={6} max={60} value={size} onChange={(e) => setSize(Number(e.target.value))} />
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
            <p className="trust-note">Recolor needs a light/grey base — upload one below (black can&apos;t be lightened).</p>
          </div>

          <div className="studio-group">
            <span className="label">Artwork blend</span>
            <div className="studio-seg">
              {BLENDS.map((b) => (
                <button
                  key={b}
                  type="button"
                  className={`studio-seg-btn${blend === b ? " studio-seg-btn--active" : ""}`}
                  onClick={() => setBlend(b)}
                >
                  {b}
                </button>
              ))}
            </div>
            <p className="trust-note">Light garment → multiply. Dark garment → screen. Flat decal → normal.</p>
          </div>

          <div className="studio-group studio-uploads">
            <button type="button" className="secondary-button" onClick={() => baseInput.current?.click()}>
              Upload garment base
            </button>
            <button type="button" className="secondary-button" onClick={() => artInput.current?.click()}>
              Upload artwork
            </button>
            <input ref={baseInput} type="file" accept="image/png,image/webp" hidden onChange={onUpload(setBase)} />
            <input ref={artInput} type="file" accept="image/png,image/svg+xml,image/webp" hidden onChange={onUpload(setArt)} />
          </div>
        </div>
      </div>
    </div>
  );
}
