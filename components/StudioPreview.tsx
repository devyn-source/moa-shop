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
  { label: "Black", value: "#141414" }
];

const BLENDS = ["multiply", "screen", "normal"] as const;
type Blend = (typeof BLENDS)[number];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

type ViewKey = "front" | "back";
type Box = { x0: number; x1: number; y0: number; y1: number };
type Loc = { id: string; label: string; box: Box; size: number };

const LOCATIONS: Record<ViewKey, Loc[]> = {
  front: [
    { id: "left-chest", label: "Left chest", box: { x0: 54, x1: 66, y0: 30, y1: 39 }, size: 11 },
    { id: "center-chest", label: "Center chest", box: { x0: 42, x1: 58, y0: 31, y1: 48 }, size: 22 },
    { id: "right-chest", label: "Right chest", box: { x0: 34, x1: 46, y0: 30, y1: 39 }, size: 11 },
    { id: "full-front", label: "Full front", box: { x0: 33, x1: 67, y0: 34, y1: 64 }, size: 44 },
    { id: "left-sleeve", label: "Left sleeve", box: { x0: 74, x1: 88, y0: 38, y1: 60 }, size: 12 },
    { id: "right-sleeve", label: "Right sleeve", box: { x0: 12, x1: 26, y0: 38, y1: 60 }, size: 12 }
  ],
  back: [
    { id: "upper-back", label: "Upper back", box: { x0: 40, x1: 60, y0: 24, y1: 33 }, size: 16 },
    { id: "center-back", label: "Center back", box: { x0: 40, x1: 60, y0: 32, y1: 56 }, size: 26 },
    { id: "lower-back", label: "Lower back", box: { x0: 40, x1: 60, y0: 54, y1: 66 }, size: 20 },
    { id: "left-sleeve", label: "Left sleeve", box: { x0: 74, x1: 88, y0: 38, y1: 60 }, size: 12 },
    { id: "right-sleeve", label: "Right sleeve", box: { x0: 12, x1: 26, y0: 38, y1: 60 }, size: 12 }
  ]
};

type Placement = { art: string; aspect: number; x: number; y: number; scale: number; rot: number; blend: Blend };
type Mode = "move" | "scale" | "rotate";

export function StudioPreview({ defaultFront, defaultBack }: { defaultFront: string; defaultBack: string }) {
  const [view, setView] = useState<ViewKey>("front");
  const [bases, setBases] = useState<Record<ViewKey, string>>({ front: defaultFront, back: defaultBack });
  const [placements, setPlacements] = useState<Record<string, Placement>>({});
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [color, setColor] = useState("");
  const [controls, setControls] = useState(true);
  const [stage, setStage] = useState({ w: 0, h: 0 });

  const stageRef = useRef<HTMLDivElement>(null);
  const baseInput = useRef<HTMLInputElement>(null);
  const artInput = useRef<HTMLInputElement>(null);
  const drag = useRef<null | {
    mode: Mode;
    key: string;
    startPx: { x: number; y: number };
    start: Placement;
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

  function keyFor(v: ViewKey, locId: string) {
    return `${v}:${locId}`;
  }
  function locFor(key: string): Loc | undefined {
    const [v, locId] = key.split(":") as [ViewKey, string];
    return LOCATIONS[v].find((l) => l.id === locId);
  }

  function selectLocation(loc: Loc) {
    const key = keyFor(view, loc.id);
    setActiveKey(key);
    setPlacements((prev) => {
      if (prev[key]) return prev;
      return {
        ...prev,
        [key]: {
          art: SAMPLE_ART,
          aspect: 90 / 240,
          x: (loc.box.x0 + loc.box.x1) / 2,
          y: (loc.box.y0 + loc.box.y1) / 2,
          scale: loc.size,
          rot: 0,
          blend: "screen"
        }
      };
    });
  }

  function updateActive(patch: Partial<Placement>) {
    if (!activeKey) return;
    setPlacements((prev) => (prev[activeKey] ? { ...prev, [activeKey]: { ...prev[activeKey], ...patch } } : prev));
  }

  function removeActive() {
    if (!activeKey) return;
    setPlacements((prev) => {
      const next = { ...prev };
      delete next[activeKey];
      return next;
    });
    setActiveKey(null);
  }

  function rect() {
    return stageRef.current!.getBoundingClientRect();
  }

  function down(mode: Mode, key: string) {
    return (event: React.PointerEvent) => {
      event.stopPropagation();
      setActiveKey(key);
      const p = placements[key];
      if (!p) return;
      const r = rect();
      const ptr = { x: event.clientX - r.left, y: event.clientY - r.top };
      const centerPx = { x: (p.x / 100) * r.width, y: (p.y / 100) * r.height };
      drag.current = {
        mode,
        key,
        startPx: ptr,
        start: { ...p },
        startDist: Math.hypot(ptr.x - centerPx.x, ptr.y - centerPx.y),
        angleOffset: Math.atan2(ptr.y - centerPx.y, ptr.x - centerPx.x) - (p.rot * Math.PI) / 180
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    };
  }

  function move(event: React.PointerEvent) {
    const it = drag.current;
    if (!it) return;
    const r = rect();
    const ptr = { x: event.clientX - r.left, y: event.clientY - r.top };
    const centerPx = { x: (it.start.x / 100) * r.width, y: (it.start.y / 100) * r.height };
    const loc = locFor(it.key);

    if (it.mode === "move") {
      const dx = ((ptr.x - it.startPx.x) / r.width) * 100;
      const dy = ((ptr.y - it.startPx.y) / r.height) * 100;
      let x = it.start.x + dx;
      let y = it.start.y + dy;
      if (loc) {
        x = clamp(x, loc.box.x0, loc.box.x1);
        y = clamp(y, loc.box.y0, loc.box.y1);
      }
      setPlacements((prev) => ({ ...prev, [it.key]: { ...prev[it.key], x, y } }));
    } else if (it.mode === "scale") {
      const dist = Math.hypot(ptr.x - centerPx.x, ptr.y - centerPx.y);
      const ratio = it.startDist > 0 ? dist / it.startDist : 1;
      setPlacements((prev) => ({ ...prev, [it.key]: { ...prev[it.key], scale: clamp(it.start.scale * ratio, 4, 95) } }));
    } else if (it.mode === "rotate") {
      const ang = Math.atan2(ptr.y - centerPx.y, ptr.x - centerPx.x);
      setPlacements((prev) => ({ ...prev, [it.key]: { ...prev[it.key], rot: ((ang - it.angleOffset) * 180) / Math.PI } }));
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

  function uploadBase(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) setBases((prev) => ({ ...prev, [view]: URL.createObjectURL(file) }));
  }

  function uploadArt(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !activeKey) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const aspect = img.naturalWidth ? img.naturalHeight / img.naturalWidth : 1;
      updateActive({ art: url, aspect });
    };
    img.src = url;
  }

  const base = bases[view];
  const active = activeKey ? placements[activeKey] : null;
  const activeLoc = activeKey ? locFor(activeKey) : undefined;
  const viewPrefix = `${view}:`;

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

  const frontCount = Object.keys(placements).filter((k) => k.startsWith("front:")).length;
  const backCount = Object.keys(placements).filter((k) => k.startsWith("back:")).length;

  return (
    <div className="studio">
      <div>
        <div className="studio-views">
          <button type="button" className={`studio-seg-btn${view === "front" ? " studio-seg-btn--active" : ""}`} onClick={() => setView("front")}>
            Front {frontCount > 0 ? `· ${frontCount}` : ""}
          </button>
          <button type="button" className={`studio-seg-btn${view === "back" ? " studio-seg-btn--active" : ""}`} onClick={() => setView("back")}>
            Back {backCount > 0 ? `· ${backCount}` : ""}
          </button>
        </div>

        <div className="studio-stage" ref={stageRef}>
          <img className="studio-base" src={base} alt={`Garment ${view}`} />
          {color ? <div className="studio-layer studio-recolor" style={{ ...maskStyle, background: color }} /> : null}

          {controls && activeLoc ? (
            <div
              className="studio-locbox"
              style={{ left: `${activeLoc.box.x0}%`, top: `${activeLoc.box.y0}%`, width: `${activeLoc.box.x1 - activeLoc.box.x0}%`, height: `${activeLoc.box.y1 - activeLoc.box.y0}%` }}
            >
              <span className="studio-locbox-tag">{activeLoc.label}</span>
            </div>
          ) : null}

          {Object.entries(placements)
            .filter(([k]) => k.startsWith(viewPrefix))
            .map(([k, p]) => {
              const boxW = (p.scale / 100) * stage.w;
              const boxH = boxW * p.aspect;
              const isActive = k === activeKey;
              return (
                <div
                  key={k}
                  className={`studio-tbox${isActive && controls ? " studio-tbox--on" : ""}`}
                  style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${boxW}px`, height: `${boxH}px`, transform: `translate(-50%, -50%) rotate(${p.rot}deg)` }}
                  onPointerDown={down("move", k)}
                  onPointerMove={move}
                  onPointerUp={up}
                >
                  <img className="studio-tbox-art" src={p.art} alt="Artwork" draggable={false} style={{ mixBlendMode: p.blend }} />
                  {isActive && controls ? (
                    <>
                      <button type="button" className="tbox-handle tbox-handle--tl" onPointerDown={down("scale", k)} onPointerMove={move} onPointerUp={up} aria-label="Resize" />
                      <button type="button" className="tbox-handle tbox-handle--tr" onPointerDown={down("scale", k)} onPointerMove={move} onPointerUp={up} aria-label="Resize" />
                      <button type="button" className="tbox-handle tbox-handle--br" onPointerDown={down("scale", k)} onPointerMove={move} onPointerUp={up} aria-label="Resize" />
                      <button type="button" className="tbox-handle tbox-handle--bl" onPointerDown={down("scale", k)} onPointerMove={move} onPointerUp={up} aria-label="Resize" />
                      <button type="button" className="tbox-rotate" onPointerDown={down("rotate", k)} onPointerMove={move} onPointerUp={up} aria-label="Rotate" />
                    </>
                  ) : null}
                </div>
              );
            })}
        </div>
      </div>

      <div className="studio-controls panel">
        <div className="panel-pad">
          <p className="eyebrow">Design studio · {view}</p>

          <div className="studio-group">
            <span className="label">Print location</span>
            <div className="studio-locs">
              {LOCATIONS[view].map((loc) => {
                const has = Boolean(placements[keyFor(view, loc.id)]);
                const isActive = activeKey === keyFor(view, loc.id);
                return (
                  <button
                    key={loc.id}
                    type="button"
                    className={`studio-loc-btn${isActive ? " studio-loc-btn--active" : ""}`}
                    onClick={() => selectLocation(loc)}
                  >
                    {loc.label}
                    {has ? <span className="studio-loc-dot" /> : null}
                  </button>
                );
              })}
            </div>
            <p className="trust-note">Pick a location → art drops in its zone. Front &amp; back hold separate artwork.</p>
          </div>

          {active && activeLoc ? (
            <>
              <div className="studio-group studio-group-head">
                <span className="label">Editing · {activeLoc.label}</span>
                <button type="button" className="ghost-button" onClick={removeActive}>Remove</button>
              </div>

              <div className="studio-group">
                <span className="label">Size · {Math.round(active.scale)}%</span>
                <input type="range" min={4} max={80} value={Math.round(active.scale)} onChange={(e) => updateActive({ scale: Number(e.target.value) })} />
              </div>
              <div className="studio-group">
                <span className="label">Rotation · {Math.round(active.rot)}°</span>
                <input type="range" min={-45} max={45} value={Math.round(active.rot)} onChange={(e) => updateActive({ rot: Number(e.target.value) })} />
              </div>
              <div className="studio-group">
                <span className="label">Artwork blend</span>
                <div className="studio-seg">
                  {BLENDS.map((b) => (
                    <button key={b} type="button" className={`studio-seg-btn${active.blend === b ? " studio-seg-btn--active" : ""}`} onClick={() => updateActive({ blend: b })}>
                      {b}
                    </button>
                  ))}
                </div>
              </div>
              <div className="studio-group">
                <button type="button" className="secondary-button" onClick={() => artInput.current?.click()}>Upload artwork for {activeLoc.label}</button>
                <input ref={artInput} type="file" accept="image/png,image/svg+xml,image/webp" hidden onChange={uploadArt} />
              </div>
            </>
          ) : (
            <p className="trust-note" style={{ marginTop: 14 }}>Select a print location to place artwork.</p>
          )}

          <div className="studio-group">
            <label className="studio-check">
              <input type="checkbox" checked={controls} onChange={(e) => setControls(e.target.checked)} />
              <span>Show handles + zone</span>
            </label>
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
          </div>

          <div className="studio-group">
            <button type="button" className="secondary-button" onClick={() => baseInput.current?.click()}>Upload {view} base</button>
            <input ref={baseInput} type="file" accept="image/png,image/webp" hidden onChange={uploadBase} />
          </div>
        </div>
      </div>
    </div>
  );
}
