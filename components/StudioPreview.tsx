"use client";

import { useEffect, useRef, useState } from "react";
import { quadTransform } from "@/lib/homography";

const SAMPLE_ART =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 90"><rect width="240" height="90" fill="none"/><text x="120" y="66" font-family="Arial, sans-serif" font-size="60" font-weight="800" letter-spacing="2" text-anchor="middle" fill="#ffffff">MOA</text></svg>`
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

type Corner = { x: number; y: number }; // % of stage
type Corners = { tl: Corner; tr: Corner; br: Corner; bl: Corner };
const CORNER_KEYS = ["tl", "tr", "br", "bl"] as const;
type CornerKey = (typeof CORNER_KEYS)[number];

const DEFAULT_CORNERS: Corners = {
  tl: { x: 41, y: 33 },
  tr: { x: 59, y: 33 },
  br: { x: 59, y: 54 },
  bl: { x: 41, y: 54 }
};

export function StudioPreview({ defaultBase }: { defaultBase: string }) {
  const [base, setBase] = useState(defaultBase);
  const [art, setArt] = useState(SAMPLE_ART);
  const [artBox, setArtBox] = useState({ w: 240, h: 90 });
  const [corners, setCorners] = useState<Corners>(DEFAULT_CORNERS);
  const [color, setColor] = useState("");
  const [blend, setBlend] = useState<Blend>("screen");
  const [shadow, setShadow] = useState(0.55);
  const [authoring, setAuthoring] = useState(true);
  const [stage, setStage] = useState({ w: 0, h: 0 });

  const stageRef = useRef<HTMLDivElement>(null);
  const baseInput = useRef<HTMLInputElement>(null);
  const artInput = useRef<HTMLInputElement>(null);
  const activeCorner = useRef<CornerKey | null>(null);

  // measure stage
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setStage({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setStage({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // measure artwork natural aspect
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) setArtBox({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = art;
  }, [art]);

  function px(c: Corner): [number, number] {
    return [(c.x / 100) * stage.w, (c.y / 100) * stage.h];
  }

  const transform =
    stage.w > 0
      ? quadTransform(artBox.w, artBox.h, [
          ...px(corners.tl),
          ...px(corners.tr),
          ...px(corners.br),
          ...px(corners.bl)
        ] as [number, number, number, number, number, number, number, number])
      : "none";

  const polygon = `polygon(${corners.tl.x}% ${corners.tl.y}%, ${corners.tr.x}% ${corners.tr.y}%, ${corners.br.x}% ${corners.br.y}%, ${corners.bl.x}% ${corners.bl.y}%)`;

  function startCorner(key: CornerKey) {
    return (event: React.PointerEvent) => {
      activeCorner.current = key;
      event.currentTarget.setPointerCapture(event.pointerId);
    };
  }
  function moveCorner(event: React.PointerEvent) {
    const key = activeCorner.current;
    if (!key || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100));
    setCorners((prev) => ({ ...prev, [key]: { x, y } }));
  }
  function endCorner(event: React.PointerEvent) {
    activeCorner.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function onUpload(setter: (url: string) => void) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) setter(URL.createObjectURL(file));
    };
  }

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

        {/* artwork mapped into the placement quad */}
        <img
          className="studio-quad-art"
          src={art}
          alt="Artwork"
          draggable={false}
          style={{ width: `${artBox.w}px`, height: `${artBox.h}px`, transform, transformOrigin: "0 0", mixBlendMode: blend }}
        />

        {/* fold shading: garment's own pixels multiplied over the art, clipped to the quad */}
        {shadow > 0 ? (
          <div
            className="studio-shadow"
            style={{
              backgroundImage: `url("${base}")`,
              clipPath: polygon,
              WebkitClipPath: polygon,
              opacity: shadow
            }}
          />
        ) : null}

        {/* authoring overlay */}
        {authoring ? (
          <>
            <svg className="studio-quad-outline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
              <polygon
                points={`${corners.tl.x},${corners.tl.y} ${corners.tr.x},${corners.tr.y} ${corners.br.x},${corners.br.y} ${corners.bl.x},${corners.bl.y}`}
              />
            </svg>
            {CORNER_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className="studio-handle"
                style={{ left: `${corners[key].x}%`, top: `${corners[key].y}%` }}
                onPointerDown={startCorner(key)}
                onPointerMove={moveCorner}
                onPointerUp={endCorner}
                aria-label={`Corner ${key}`}
              />
            ))}
          </>
        ) : null}
      </div>

      <div className="studio-controls panel">
        <div className="panel-pad">
          <p className="eyebrow">Design studio · corner-pin prototype</p>

          <div className="studio-group">
            <label className="studio-check">
              <input type="checkbox" checked={authoring} onChange={(e) => setAuthoring(e.target.checked)} />
              <span>Authoring mode — drag the 4 corners to fit the print area</span>
            </label>
          </div>

          <div className="studio-group">
            <span className="label">Fold shading · {Math.round(shadow * 100)}%</span>
            <input type="range" min={0} max={100} value={Math.round(shadow * 100)} onChange={(e) => setShadow(Number(e.target.value) / 100)} />
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
            <p className="trust-note">Light garment → multiply. Dark garment → screen. Flat decal → normal.</p>
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
            <p className="trust-note">Recolor + fold shading both shine on a light/grey base — upload one below.</p>
          </div>

          <div className="studio-group studio-uploads">
            <button type="button" className="secondary-button" onClick={() => baseInput.current?.click()}>Upload garment base</button>
            <button type="button" className="secondary-button" onClick={() => artInput.current?.click()}>Upload artwork</button>
            <button type="button" className="ghost-button" onClick={() => setCorners(DEFAULT_CORNERS)}>Reset corners</button>
            <input ref={baseInput} type="file" accept="image/png,image/webp" hidden onChange={onUpload(setBase)} />
            <input ref={artInput} type="file" accept="image/png,image/svg+xml,image/webp" hidden onChange={onUpload(setArt)} />
          </div>
        </div>
      </div>
    </div>
  );
}
