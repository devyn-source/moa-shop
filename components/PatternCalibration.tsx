"use client";

import { useCallback, useEffect, useState } from "react";

type Unit = "mm" | "cm" | "in";
type Front = {
  unit: Unit;
  paneled: boolean;
  onFold: boolean;
  bodyLengthIn: number;
  frontWidthIn: number;
  chestCircIn: number;
  outlineIn: [number, number][];
  pieces: string[];
  confidence: "high" | "medium" | "low";
  notes: string[];
};

// Renders the extracted front outline so the operator can eyeball it before
// committing. Flip Y (DXF is Y-up, SVG is Y-down) so it reads right-side-up.
function Outline({ pts }: { pts: [number, number][] }) {
  if (pts.length < 3) return null;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), maxY = Math.max(...ys), minY = Math.min(...ys);
  const w = maxX - minX || 1, h = maxY - minY || 1;
  const W = 150, H = Math.round((h / w) * W);
  const sc = W / w;
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${((x - minX) * sc).toFixed(1)} ${((maxY - y) * sc).toFixed(1)}`).join(" ") + " Z";
  return (
    <svg className="patcal-svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-label="Front pattern outline">
      <path d={d} fill="rgba(176,71,49,0.08)" stroke="var(--color-terracotta)" strokeWidth={1.2} />
    </svg>
  );
}

export default function PatternCalibration({ slug, hasDxf }: { slug: string; hasDxf: boolean }) {
  const [front, setFront] = useState<Front | null>(null);
  const [hasMockup, setHasMockup] = useState(true);
  const [unit, setUnit] = useState<Unit | "">("");
  const [onFold, setOnFold] = useState<boolean | null>(null);
  const [chestIn, setChestIn] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [applied, setApplied] = useState<string | null>(null);

  // Pull the proposal, honoring any operator unit/fold overrides.
  const preview = useCallback(
    async (over?: { unit?: Unit | ""; onFold?: boolean | null }) => {
      setLoading(true);
      setErr(null);
      setApplied(null);
      try {
        const u = over?.unit ?? unit;
        const f = over?.onFold ?? onFold;
        const qs = new URLSearchParams();
        if (u) qs.set("unit", u);
        if (f !== null && f !== undefined) qs.set("onFold", String(f));
        const res = await fetch(`/api/admin/pattern-calibrate/${slug}?${qs}`);
        const data = (await res.json()) as { front?: Front; hasMockup?: boolean; error?: string };
        if (!res.ok || !data.front) throw new Error(data.error || "Couldn't read the pattern");
        setFront(data.front);
        setHasMockup(data.hasMockup ?? false);
        setUnit(data.front.unit);
        setOnFold(data.front.onFold);
        setChestIn(String(data.front.frontWidthIn));
      } catch (e) {
        setFront(null);
        setErr(e instanceof Error ? e.message : "Failed");
      } finally {
        setLoading(false);
      }
    },
    [slug, unit, onFold]
  );

  // First extraction on mount (when a DXF exists).
  useEffect(() => {
    if (hasDxf) void preview({ unit: "", onFold: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasDxf]);

  const apply = async () => {
    setApplying(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/pattern-calibrate/${slug}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ unit: unit || undefined, onFold, frontWidthIn: parseFloat(chestIn) || undefined }),
      });
      const data = (await res.json()) as { ok?: boolean; appliedChestIn?: number; bodyLengthIn?: number; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Apply failed");
      setApplied(`Calibration saved — chest ${data.appliedChestIn}″, body ${data.bodyLengthIn}″. The tech-pack placement now reads from the pattern.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Apply failed");
    } finally {
      setApplying(false);
    }
  };

  if (!hasDxf) return null;

  return (
    <section className="assetmgr-card patcal">
      <div className="assetmgr-card-head">
        <h2>Pattern calibration</h2>
        <span className="assetmgr-tag assetmgr-tag--gated">Drives tech-pack placement</span>
      </div>
      <p className="assetmgr-note">
        Reads the true chest width + body length from the DXF and uses them as the placement ruler — replacing the photo-silhouette estimate. Confirm the numbers below, then apply.
      </p>

      {loading && !front ? <p className="assetmgr-empty">Reading pattern…</p> : null}
      {err ? <p className="assetmgr-err">⚠ {err}</p> : null}

      {front ? (
        <div className="patcal-body">
          <div className="patcal-preview">
            <Outline pts={front.outlineIn} />
            <span className={`patcal-conf patcal-conf--${front.confidence}`}>{front.confidence} confidence</span>
          </div>

          <div className="patcal-fields">
            <label className="patcal-field">
              <span>Units (auto-resolved)</span>
              <select
                value={unit}
                onChange={(e) => { const u = e.target.value as Unit; setUnit(u); void preview({ unit: u }); }}
              >
                <option value="mm">Millimeters</option>
                <option value="cm">Centimeters</option>
                <option value="in">Inches</option>
              </select>
            </label>

            <label className="patcal-field">
              <span>Body length (HPS→hem)</span>
              <input value={`${front.bodyLengthIn}″`} readOnly />
            </label>

            <label className="patcal-field">
              <span>Full front width (chest)</span>
              <input type="number" step="0.25" value={chestIn} onChange={(e) => setChestIn(e.target.value)} />
            </label>

            {!front.paneled ? (
              <label className="patcal-field patcal-field--check">
                <input
                  type="checkbox"
                  checked={Boolean(onFold)}
                  onChange={(e) => { setOnFold(e.target.checked); void preview({ onFold: e.target.checked }); }}
                />
                <span>Front is a half (cut on fold / paired) — double the width</span>
              </label>
            ) : null}

            <p className="patcal-pieces">Pieces: {front.pieces.join(", ")} · implied chest ≈ {front.chestCircIn}″</p>
          </div>
        </div>
      ) : null}

      {front ? (
        <ul className="patcal-notes">
          {front.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
          {!hasMockup ? <li className="patcal-warn">⚠ No base-front.png mockup yet — add the product shot before applying.</li> : null}
        </ul>
      ) : null}

      {applied ? <p className="patcal-applied">✓ {applied}</p> : null}

      {front ? (
        <button type="button" className="assetmgr-drop assetmgr-drop--inline" disabled={applying || loading || !hasMockup} onClick={apply}>
          {applying ? "Applying…" : "Apply as calibration"}
        </button>
      ) : null}
    </section>
  );
}
