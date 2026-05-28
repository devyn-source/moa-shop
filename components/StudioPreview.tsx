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

export function StudioPreview({ defaultBase }: { defaultBase: string }) {
  const [base, setBase] = useState(defaultBase);
  const [art, setArt] = useState(SAMPLE_ART);
  const [color, setColor] = useState("");
  const [blend, setBlend] = useState<Blend>("screen");
  const [size, setSize] = useState(24);
  const [posY, setPosY] = useState(40);
  const [posX, setPosX] = useState(50);
  const baseInput = useRef<HTMLInputElement>(null);
  const artInput = useRef<HTMLInputElement>(null);

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
      <div className="studio-stage">
        <img className="studio-base" src={base} alt="Garment base" />
        {color ? (
          <div className="studio-layer studio-recolor" style={{ ...maskStyle, background: color }} />
        ) : null}
        <div
          className="studio-layer studio-art"
          style={{
            ...maskStyle,
            backgroundImage: `url("${art}")`,
            backgroundSize: `${size}%`,
            backgroundPosition: `${posX}% ${posY}%`,
            backgroundRepeat: "no-repeat",
            mixBlendMode: blend
          }}
        />
      </div>

      <div className="studio-controls panel">
        <div className="panel-pad">
          <p className="eyebrow">Design studio · prototype</p>

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
            <p className="trust-note">Recolor needs a light/grey base — upload one below to see it work (black can&apos;t be lightened).</p>
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

          <div className="studio-group">
            <span className="label">Graphic size · {size}%</span>
            <input type="range" min={8} max={60} value={size} onChange={(e) => setSize(Number(e.target.value))} />
          </div>
          <div className="studio-group studio-group--row">
            <label className="studio-mini">
              <span className="label">Up / down · {posY}%</span>
              <input type="range" min={10} max={75} value={posY} onChange={(e) => setPosY(Number(e.target.value))} />
            </label>
            <label className="studio-mini">
              <span className="label">Left / right · {posX}%</span>
              <input type="range" min={20} max={80} value={posX} onChange={(e) => setPosX(Number(e.target.value))} />
            </label>
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
