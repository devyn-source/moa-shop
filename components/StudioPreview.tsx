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
type Loc = { id: string; label: string; box: Box; size: number; rot?: number };
type ViewZones = Record<ViewKey, Loc[]>;

const PLACEMENT_ZONES: Record<string, ViewZones> = {
  "heavyweight-hoodie": {
    front: [
      { id: "left-chest", label: "Left chest", box: { x0: 55, x1: 66, y0: 40, y1: 47 }, size: 10 },
      { id: "center-chest", label: "Center chest", box: { x0: 38, x1: 62, y0: 41, y1: 56 }, size: 22 },
      { id: "right-chest", label: "Right chest", box: { x0: 34, x1: 45, y0: 40, y1: 47 }, size: 10 },
      { id: "full-front", label: "Full front", box: { x0: 30, x1: 70, y0: 39, y1: 70 }, size: 42 },
      { id: "left-sleeve", label: "Left sleeve", box: { x0: 77, x1: 89, y0: 45, y1: 62 }, size: 10 },
      { id: "right-sleeve", label: "Right sleeve", box: { x0: 11, x1: 23, y0: 45, y1: 62 }, size: 10 }
    ],
    back: [
      { id: "upper-back", label: "Upper back", box: { x0: 38, x1: 62, y0: 36, y1: 43 }, size: 16 },
      { id: "center-back", label: "Center back", box: { x0: 34, x1: 66, y0: 44, y1: 66 }, size: 28 },
      { id: "lower-back", label: "Lower back", box: { x0: 38, x1: 62, y0: 66, y1: 77 }, size: 20 },
      { id: "left-sleeve", label: "Left sleeve", box: { x0: 77, x1: 89, y0: 46, y1: 62 }, size: 10 },
      { id: "right-sleeve", label: "Right sleeve", box: { x0: 11, x1: 23, y0: 46, y1: 62 }, size: 10 }
    ]
  },
  default: {
    front: [
      { id: "left-chest", label: "Left chest", box: { x0: 55, x1: 66, y0: 40, y1: 47 }, size: 10 },
      { id: "center-chest", label: "Center chest", box: { x0: 38, x1: 62, y0: 41, y1: 56 }, size: 22 },
      { id: "right-chest", label: "Right chest", box: { x0: 34, x1: 45, y0: 40, y1: 47 }, size: 10 },
      { id: "full-front", label: "Full front", box: { x0: 30, x1: 70, y0: 39, y1: 70 }, size: 42 }
    ],
    back: [
      { id: "upper-back", label: "Upper back", box: { x0: 38, x1: 62, y0: 36, y1: 43 }, size: 16 },
      { id: "center-back", label: "Center back", box: { x0: 34, x1: 66, y0: 44, y1: 66 }, size: 28 },
      { id: "lower-back", label: "Lower back", box: { x0: 38, x1: 62, y0: 66, y1: 77 }, size: 20 }
    ]
  }
};

type Mode = "place" | "author";
type PlaceMode = "move" | "scale" | "rotate";
type ZoneMode = "move" | "nw" | "ne" | "se" | "sw" | "rotate";
type Placement = { art: string; aspect: number; x: number; y: number; scale: number; rot: number; blend: Blend };

export function StudioPreview({
  productSlug,
  defaultFront,
  defaultBack
}: {
  productSlug: string;
  defaultFront: string;
  defaultBack: string;
}) {
  const [mode, setMode] = useState<Mode>("place");
  const [view, setView] = useState<ViewKey>("front");
  const [bases, setBases] = useState<Record<ViewKey, string>>({ front: defaultFront, back: defaultBack });
  const [zoneConfig, setZoneConfig] = useState<ViewZones>(
    () => structuredClone(PLACEMENT_ZONES[productSlug] ?? PLACEMENT_ZONES.default)
  );
  const [placements, setPlacements] = useState<Record<string, Placement>>({});
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [activeZone, setActiveZone] = useState<string | null>(null);
  const [color, setColor] = useState("");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [stage, setStage] = useState({ w: 0, h: 0 });

  const stageRef = useRef<HTMLDivElement>(null);
  const baseInput = useRef<HTMLInputElement>(null);
  const artInput = useRef<HTMLInputElement>(null);
  const drag = useRef<null | { mode: PlaceMode; key: string; startPx: { x: number; y: number }; start: Placement; startDist: number; angleOffset: number }>(null);
  const zdrag = useRef<null | { mode: ZoneMode; id: string; startPx: { x: number; y: number }; startBox: Box; startRot: number; angleOffset: number }>(null);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStage({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setStage({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // load saved zones for this product (falls back to seed defaults)
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/zones/${productSlug}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d?.zones?.front && d?.zones?.back) setZoneConfig(d.zones as ViewZones);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [productSlug]);

  const keyFor = (v: ViewKey, locId: string) => `${v}:${locId}`;
  const locFor = (key: string) => {
    const [v, locId] = key.split(":") as [ViewKey, string];
    return zoneConfig[v].find((l) => l.id === locId);
  };
  const rect = () => stageRef.current!.getBoundingClientRect();
  const ptrPct = (e: React.PointerEvent) => {
    const r = rect();
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  };
  // rotate a %-point around a %-center by deg, doing the math in px so the
  // 4:5 aspect doesn't skew the angle.
  const sx = stage.w / 100 || 1;
  const sy = stage.h / 100 || 1;
  function rotatePct(p: { x: number; y: number }, c: { x: number; y: number }, deg: number) {
    const r = (deg * Math.PI) / 180;
    const cos = Math.cos(r);
    const sin = Math.sin(r);
    const dx = p.x * sx - c.x * sx;
    const dy = p.y * sy - c.y * sy;
    return { x: (c.x * sx + dx * cos - dy * sin) / sx, y: (c.y * sy + dx * sin + dy * cos) / sy };
  }
  const boxCenter = (b: Box) => ({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 });

  /* ---------- place mode ---------- */
  function selectLocation(loc: Loc) {
    const key = keyFor(view, loc.id);
    setActiveKey(key);
    setPlacements((prev) =>
      prev[key]
        ? prev
        : { ...prev, [key]: { art: SAMPLE_ART, aspect: 90 / 240, x: (loc.box.x0 + loc.box.x1) / 2, y: (loc.box.y0 + loc.box.y1) / 2, scale: loc.size, rot: loc.rot ?? 0, blend: "screen" } }
    );
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
  function pDown(m: PlaceMode, key: string) {
    return (e: React.PointerEvent) => {
      e.stopPropagation();
      setActiveKey(key);
      const p = placements[key];
      if (!p) return;
      const r = rect();
      const px = { x: e.clientX - r.left, y: e.clientY - r.top };
      const c = { x: (p.x / 100) * r.width, y: (p.y / 100) * r.height };
      drag.current = { mode: m, key, startPx: px, start: { ...p }, startDist: Math.hypot(px.x - c.x, px.y - c.y), angleOffset: Math.atan2(px.y - c.y, px.x - c.x) - (p.rot * Math.PI) / 180 };
      e.currentTarget.setPointerCapture(e.pointerId);
    };
  }
  function pMove(e: React.PointerEvent) {
    const it = drag.current;
    if (!it) return;
    const r = rect();
    const px = { x: e.clientX - r.left, y: e.clientY - r.top };
    const c = { x: (it.start.x / 100) * r.width, y: (it.start.y / 100) * r.height };
    const loc = locFor(it.key);
    if (it.mode === "move") {
      let x = it.start.x + ((px.x - it.startPx.x) / r.width) * 100;
      let y = it.start.y + ((px.y - it.startPx.y) / r.height) * 100;
      if (loc) {
        const deg = loc.rot ?? 0;
        const c = boxCenter(loc.box);
        const local = rotatePct({ x, y }, c, -deg); // into the zone's own frame
        local.x = clamp(local.x, loc.box.x0, loc.box.x1);
        local.y = clamp(local.y, loc.box.y0, loc.box.y1);
        const world = rotatePct(local, c, deg);
        x = world.x;
        y = world.y;
      }
      setPlacements((prev) => ({ ...prev, [it.key]: { ...prev[it.key], x, y } }));
    } else if (it.mode === "scale") {
      const d = Math.hypot(px.x - c.x, px.y - c.y);
      const ratio = it.startDist > 0 ? d / it.startDist : 1;
      setPlacements((prev) => ({ ...prev, [it.key]: { ...prev[it.key], scale: clamp(it.start.scale * ratio, 4, 95) } }));
    } else {
      const a = Math.atan2(px.y - c.y, px.x - c.x);
      setPlacements((prev) => ({ ...prev, [it.key]: { ...prev[it.key], rot: ((a - it.angleOffset) * 180) / Math.PI } }));
    }
  }
  function endDrag(e: React.PointerEvent) {
    drag.current = null;
    zdrag.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }

  /* ---------- author mode ---------- */
  function updateZone(id: string, patch: Partial<Loc>) {
    setZoneConfig((prev) => ({ ...prev, [view]: prev[view].map((z) => (z.id === id ? { ...z, ...patch } : z)) }));
  }
  function addZone() {
    const id = `zone-${Date.now().toString().slice(-4)}`;
    setZoneConfig((prev) => ({ ...prev, [view]: [...prev[view], { id, label: "New zone", box: { x0: 42, x1: 58, y0: 44, y1: 56 }, size: 20 }] }));
    setActiveZone(id);
  }
  function deleteZone(id: string) {
    setZoneConfig((prev) => ({ ...prev, [view]: prev[view].filter((z) => z.id !== id) }));
    if (activeZone === id) setActiveZone(null);
  }
  function zDown(m: ZoneMode, id: string) {
    return (e: React.PointerEvent) => {
      e.stopPropagation();
      setActiveZone(id);
      const z = zoneConfig[view].find((zz) => zz.id === id);
      if (!z) return;
      const p = ptrPct(e);
      const c = boxCenter(z.box);
      const startRot = z.rot ?? 0;
      const ang = Math.atan2((p.y - c.y) * sy, (p.x - c.x) * sx);
      zdrag.current = { mode: m, id, startPx: p, startBox: { ...z.box }, startRot, angleOffset: ang - (startRot * Math.PI) / 180 };
      e.currentTarget.setPointerCapture(e.pointerId);
    };
  }
  function zMove(e: React.PointerEvent) {
    const it = zdrag.current;
    if (!it) return;
    const p = ptrPct(e);
    const b = { ...it.startBox };
    const MIN = 3;
    const c = boxCenter(b);

    if (it.mode === "rotate") {
      const ang = Math.atan2((p.y - c.y) * sy, (p.x - c.x) * sx);
      updateZone(it.id, { rot: ((ang - it.angleOffset) * 180) / Math.PI });
      return;
    }
    if (it.mode === "move") {
      const dx = p.x - it.startPx.x;
      const dy = p.y - it.startPx.y;
      let nx0 = b.x0 + dx, nx1 = b.x1 + dx, ny0 = b.y0 + dy, ny1 = b.y1 + dy;
      if (nx0 < 0) { nx1 -= nx0; nx0 = 0; }
      if (nx1 > 100) { nx0 -= nx1 - 100; nx1 = 100; }
      if (ny0 < 0) { ny1 -= ny0; ny0 = 0; }
      if (ny1 > 100) { ny0 -= ny1 - 100; ny1 = 100; }
      updateZone(it.id, { box: { x0: nx0, x1: nx1, y0: ny0, y1: ny1 } });
      return;
    }
    // corner resize — work in the zone's own (un-rotated) frame
    const deg = it.startRot;
    const local = deg ? rotatePct(p, c, -deg) : p;
    const box = { ...b };
    if (it.mode.includes("w")) box.x0 = clamp(local.x, 0, b.x1 - MIN);
    if (it.mode.includes("e")) box.x1 = clamp(local.x, b.x0 + MIN, 100);
    if (it.mode.includes("n")) box.y0 = clamp(local.y, 0, b.y1 - MIN);
    if (it.mode.includes("s")) box.y1 = clamp(local.y, b.y0 + MIN, 100);
    updateZone(it.id, { box });
  }
  async function copyConfig() {
    const out = JSON.stringify({ [productSlug]: zoneConfig }, null, 2);
    try {
      await navigator.clipboard.writeText(out);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  }

  async function saveZones() {
    setSaving(true);
    setSaved(false);
    try {
      const r = await fetch(`/api/zones/${productSlug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zones: zoneConfig })
      });
      if (r.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2200);
      }
    } finally {
      setSaving(false);
    }
  }

  /* ---------- uploads ---------- */
  function uploadBase(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setBases((prev) => ({ ...prev, [view]: URL.createObjectURL(file) }));
  }
  function uploadArt(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeKey) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => updateActive({ art: url, aspect: img.naturalWidth ? img.naturalHeight / img.naturalWidth : 1 });
    img.src = url;
  }

  const base = bases[view];
  const active = activeKey ? placements[activeKey] : null;
  const activeLoc = activeKey ? locFor(activeKey) : undefined;
  const editingZone = activeZone ? zoneConfig[view].find((z) => z.id === activeZone) : undefined;
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
      <div>
        <div className="studio-views" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <button type="button" className={`studio-seg-btn${mode === "place" ? " studio-seg-btn--active" : ""}`} onClick={() => setMode("place")}>Place artwork</button>
          <button type="button" className={`studio-seg-btn${mode === "author" ? " studio-seg-btn--active" : ""}`} onClick={() => setMode("author")}>Author zones</button>
        </div>

        <div className="studio-views">
          <button type="button" className={`studio-seg-btn${view === "front" ? " studio-seg-btn--active" : ""}`} onClick={() => setView("front")}>Front</button>
          <button type="button" className={`studio-seg-btn${view === "back" ? " studio-seg-btn--active" : ""}`} onClick={() => setView("back")}>Back</button>
        </div>

        <div className="studio-stage" ref={stageRef}>
          <img className="studio-base" src={base} alt={`Garment ${view}`} />
          {color ? <div className="studio-layer studio-recolor" style={{ ...maskStyle, background: color }} /> : null}

          {mode === "place" ? (
            <>
              {activeLoc ? (
                <div className="studio-locbox" style={{ left: `${activeLoc.box.x0}%`, top: `${activeLoc.box.y0}%`, width: `${activeLoc.box.x1 - activeLoc.box.x0}%`, height: `${activeLoc.box.y1 - activeLoc.box.y0}%`, transform: `rotate(${activeLoc.rot ?? 0}deg)` }}>
                  <span className="studio-locbox-tag">{activeLoc.label}</span>
                </div>
              ) : null}
              {Object.entries(placements)
                .filter(([k]) => k.startsWith(`${view}:`))
                .map(([k, p]) => {
                  const boxW = (p.scale / 100) * stage.w;
                  const isActive = k === activeKey;
                  return (
                    <div key={k} className={`studio-tbox${isActive ? " studio-tbox--on" : ""}`} style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${boxW}px`, height: `${boxW * p.aspect}px`, transform: `translate(-50%, -50%) rotate(${p.rot}deg)` }} onPointerDown={pDown("move", k)} onPointerMove={pMove} onPointerUp={endDrag}>
                      <img className="studio-tbox-art" src={p.art} alt="Artwork" draggable={false} style={{ mixBlendMode: p.blend }} />
                      {isActive ? (
                        <>
                          <button type="button" className="tbox-handle tbox-handle--tl" onPointerDown={pDown("scale", k)} onPointerMove={pMove} onPointerUp={endDrag} aria-label="Resize" />
                          <button type="button" className="tbox-handle tbox-handle--tr" onPointerDown={pDown("scale", k)} onPointerMove={pMove} onPointerUp={endDrag} aria-label="Resize" />
                          <button type="button" className="tbox-handle tbox-handle--br" onPointerDown={pDown("scale", k)} onPointerMove={pMove} onPointerUp={endDrag} aria-label="Resize" />
                          <button type="button" className="tbox-handle tbox-handle--bl" onPointerDown={pDown("scale", k)} onPointerMove={pMove} onPointerUp={endDrag} aria-label="Resize" />
                          <button type="button" className="tbox-rotate" onPointerDown={pDown("rotate", k)} onPointerMove={pMove} onPointerUp={endDrag} aria-label="Rotate" />
                        </>
                      ) : null}
                    </div>
                  );
                })}
            </>
          ) : (
            [...zoneConfig[view]]
              .sort((a, b) => {
                const aa = a.id === activeZone;
                const ba = b.id === activeZone;
                if (aa !== ba) return aa ? 1 : -1; // active renders last (on top)
                const areaA = (a.box.x1 - a.box.x0) * (a.box.y1 - a.box.y0);
                const areaB = (b.box.x1 - b.box.x0) * (b.box.y1 - b.box.y0);
                return areaB - areaA; // larger first (underneath), smaller on top
              })
              .map((z) => {
              const isActive = z.id === activeZone;
              return (
                <div key={z.id} className={`studio-azone${isActive ? " studio-azone--active" : ""}`} style={{ left: `${z.box.x0}%`, top: `${z.box.y0}%`, width: `${z.box.x1 - z.box.x0}%`, height: `${z.box.y1 - z.box.y0}%`, transform: `rotate(${z.rot ?? 0}deg)` }} onPointerDown={zDown("move", z.id)} onPointerMove={zMove} onPointerUp={endDrag}>
                  <span className="studio-locbox-tag">{z.label}</span>
                  {isActive ? (
                    <>
                      <button type="button" className="azone-handle azone-handle--nw" onPointerDown={zDown("nw", z.id)} onPointerMove={zMove} onPointerUp={endDrag} aria-label="Resize" />
                      <button type="button" className="azone-handle azone-handle--ne" onPointerDown={zDown("ne", z.id)} onPointerMove={zMove} onPointerUp={endDrag} aria-label="Resize" />
                      <button type="button" className="azone-handle azone-handle--se" onPointerDown={zDown("se", z.id)} onPointerMove={zMove} onPointerUp={endDrag} aria-label="Resize" />
                      <button type="button" className="azone-handle azone-handle--sw" onPointerDown={zDown("sw", z.id)} onPointerMove={zMove} onPointerUp={endDrag} aria-label="Resize" />
                      <button type="button" className="azone-rotate" onPointerDown={zDown("rotate", z.id)} onPointerMove={zMove} onPointerUp={endDrag} aria-label="Rotate zone" />
                    </>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="studio-controls panel">
        <div className="panel-pad">
          {mode === "place" ? (
            <>
              <p className="eyebrow">Place artwork · {view}</p>
              <div className="studio-group">
                <span className="label">Print location</span>
                <div className="studio-locs">
                  {zoneConfig[view].map((loc) => {
                    const has = Boolean(placements[keyFor(view, loc.id)]);
                    const isActive = activeKey === keyFor(view, loc.id);
                    return (
                      <button key={loc.id} type="button" className={`studio-loc-btn${isActive ? " studio-loc-btn--active" : ""}`} onClick={() => selectLocation(loc)}>
                        {loc.label}
                        {has ? <span className="studio-loc-dot" /> : null}
                      </button>
                    );
                  })}
                </div>
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
                        <button key={b} type="button" className={`studio-seg-btn${active.blend === b ? " studio-seg-btn--active" : ""}`} onClick={() => updateActive({ blend: b })}>{b}</button>
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
            </>
          ) : (
            <>
              <p className="eyebrow">Author zones · {view}</p>
              <p className="trust-note">Drag a zone to move · corners resize. Define each print location precisely on the mockup.</p>
              <div className="studio-group">
                <div className="studio-locs">
                  {zoneConfig[view].map((z) => (
                    <button key={z.id} type="button" className={`studio-loc-btn${activeZone === z.id ? " studio-loc-btn--active" : ""}`} onClick={() => setActiveZone(z.id)}>{z.label}</button>
                  ))}
                </div>
                <button type="button" className="secondary-button" style={{ marginTop: 8 }} onClick={addZone}>+ Add zone</button>
              </div>

              {editingZone ? (
                <>
                  <div className="studio-group studio-group-head">
                    <span className="label">Editing zone</span>
                    <button type="button" className="ghost-button" onClick={() => deleteZone(editingZone.id)}>Delete</button>
                  </div>
                  <label className="field">
                    <span className="label">Label</span>
                    <input value={editingZone.label} onChange={(e) => updateZone(editingZone.id, { label: e.target.value })} />
                  </label>
                  <label className="field" style={{ marginTop: 10 }}>
                    <span className="label">Default art size · {editingZone.size}%</span>
                    <input type="range" min={4} max={80} value={editingZone.size} onChange={(e) => updateZone(editingZone.id, { size: Number(e.target.value) })} />
                  </label>
                  <label className="field" style={{ marginTop: 10 }}>
                    <span className="label">Rotation · {Math.round(editingZone.rot ?? 0)}°</span>
                    <input type="range" min={-90} max={90} value={Math.round(editingZone.rot ?? 0)} onChange={(e) => updateZone(editingZone.id, { rot: Number(e.target.value) })} />
                  </label>
                  <p className="trust-note" style={{ marginTop: 8 }}>
                    Box: {Math.round(editingZone.box.x0)},{Math.round(editingZone.box.y0)} → {Math.round(editingZone.box.x1)},{Math.round(editingZone.box.y1)} · {Math.round(editingZone.rot ?? 0)}°
                  </p>
                </>
              ) : (
                <p className="trust-note" style={{ marginTop: 14 }}>Select or add a zone to edit it.</p>
              )}

              <div className="studio-group">
                <button type="button" className="button button--lg button--full" onClick={saveZones} disabled={saving}>
                  {saving ? "Saving…" : saved ? "Saved ✓" : "Save zones for this SKU"}
                </button>
                <button type="button" className="ghost-button" style={{ marginTop: 8 }} onClick={copyConfig}>{copied ? "Copied ✓" : "Copy JSON"}</button>
                <p className="trust-note">Saved to the catalog — these zones load automatically next time and in Place mode.</p>
              </div>
            </>
          )}

          <div className="studio-group">
            <span className="label">Garment color</span>
            <div className="studio-swatches">
              {SWATCHES.map((s) => (
                <button key={s.label} type="button" title={s.label} className={`studio-swatch${color === s.value ? " studio-swatch--active" : ""}${s.value === "" ? " studio-swatch--none" : ""}`} style={s.value ? { background: s.value } : undefined} onClick={() => setColor(s.value)}>
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
