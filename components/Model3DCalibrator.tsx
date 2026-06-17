"use client";

import { useCallback, useEffect, useState } from "react";
import { model3dPlacement, type Model3DCalibration } from "@/lib/zones";

// 3D-anchored calibration panel (admin). Shows the SKU's live calibration —
// inches-per-world derived from the GLB + DXF/spec body length — with the
// implied-width cross-check, a sample-placement sanity readout, and Re-compute /
// Apply. This is the operator's window onto the exact placement ruler.

type Report = {
  modelUrl: string;
  rawSize: { x: number; y: number; z: number };
  worldHeight: number;
  bodyLengthIn: number;
  chestWidthIn: number | null;
  impliedModelWidthIn: number;
  chestRatio: number | null;
  source: string;
  confidence: string;
};

const confClass = (c?: string) =>
  c === "high" ? "m3dcal-badge--high" : c === "medium" ? "m3dcal-badge--med" : "m3dcal-badge--low";

export default function Model3DCalibrator({ slug, hasModel }: { slug: string; hasModel: boolean }) {
  const [stored, setStored] = useState<Model3DCalibration | null>(null);
  const [proposal, setProposal] = useState<Model3DCalibration | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const loadStored = useCallback(async () => {
    try {
      const r = await fetch(`/api/zones/${slug}`);
      if (r.ok) {
        const d = await r.json();
        setStored(d?.calibration?.model3d ?? null);
      }
    } catch {
      /* ignore — proposal still renders */
    }
  }, [slug]);

  const compute = useCallback(async () => {
    setLoading(true);
    setError(null);
    setApplied(false);
    try {
      const r = await fetch(`/api/admin/calibrate-3d/${slug}`);
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "Couldn't compute the calibration.");
        setProposal(null);
        setReport(null);
      } else {
        setProposal(d.model3d);
        setReport(d.report);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (hasModel) {
      loadStored();
      compute();
    }
  }, [hasModel, loadStored, compute]);

  const apply = async () => {
    setApplying(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/calibrate-3d/${slug}`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) setError(d.error || "Couldn't apply the calibration.");
      else {
        setStored(d.model3d);
        setApplied(true);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setApplying(false);
    }
  };

  if (!hasModel) {
    return (
      <section className="m3dcal">
        <header className="m3dcal-head">
          <h2 className="m3dcal-title">3D Calibration</h2>
        </header>
        <p className="m3dcal-empty">No 3D model (GLB) for this SKU yet. Upload one above, then calibrate.</p>
      </section>
    );
  }

  const cal = proposal ?? stored;
  // Sample sanity: what a 3.5" left-chest logo derives to off this calibration.
  const sample = cal
    ? model3dPlacement(
        cal,
        {
          centerWorldX: 3.5 / cal.inchesPerWorld,
          centerWorldY: cal.hpsWorldY - 4.25 / cal.inchesPerWorld,
          widthWorld: 3.5 / cal.inchesPerWorld,
          heightWorld: 3.5 / cal.inchesPerWorld,
        },
        "front"
      )
    : null;

  const dirty = Boolean(stored && proposal && JSON.stringify(stored) !== JSON.stringify(proposal));

  return (
    <section className="m3dcal">
      <header className="m3dcal-head">
        <h2 className="m3dcal-title">3D Calibration</h2>
        {cal ? <span className={`m3dcal-badge ${confClass(cal.confidence)}`}>{cal.confidence} confidence</span> : null}
        {stored ? <span className="m3dcal-state">Calibrated</span> : <span className="m3dcal-state m3dcal-state--off">Not applied</span>}
      </header>
      <p className="m3dcal-lede">
        Anchors the 3D model to real inches so placement is derived off the actual garment surface — the Studio
        readout, decoration sheet, and tech pack all read these numbers.
      </p>

      {error ? <p className="m3dcal-error">{error}</p> : null}

      {cal ? (
        <>
          <div className="m3dcal-grid">
            <div className="m3dcal-stat">
              <span className="m3dcal-label">Inches / world</span>
              <strong className="m3dcal-value">{cal.inchesPerWorld}</strong>
              <span className="m3dcal-sub">the scale</span>
            </div>
            <div className="m3dcal-stat">
              <span className="m3dcal-label">Body length</span>
              <strong className="m3dcal-value">{cal.bodyLengthIn}&Prime;</strong>
              <span className="m3dcal-sub">{cal.source}</span>
            </div>
            <div className="m3dcal-stat">
              <span className="m3dcal-label">HPS · world Y</span>
              <strong className="m3dcal-value">{cal.hpsWorldY}</strong>
              <span className="m3dcal-sub">collar datum</span>
            </div>
            <div className="m3dcal-stat">
              <span className="m3dcal-label">Chest cross-check</span>
              <strong className="m3dcal-value">{report ? `${report.chestRatio ?? "—"}×` : "—"}</strong>
              <span className="m3dcal-sub">
                {report ? `model ${report.impliedModelWidthIn}″ vs spec ${cal.chestWidthIn ?? "—"}″` : "—"}
              </span>
            </div>
          </div>

          {sample ? (
            <div className="m3dcal-sanity">
              <span className="m3dcal-sanity-label">Sanity · a 3.5&Prime; left-chest logo derives to</span>
              <span className="m3dcal-sanity-val">
                {sample.widthIn}&Prime; wide · {sample.belowHpsIn}&Prime; below HPS · {sample.horizontal}
              </span>
            </div>
          ) : null}

          {dirty ? <p className="m3dcal-dirty">Re-computed values differ from what’s stored — Apply to save them.</p> : null}
        </>
      ) : (
        !loading && <p className="m3dcal-empty">No calibration computed yet.</p>
      )}

      <div className="m3dcal-actions">
        <button type="button" className="m3dcal-btn m3dcal-btn--ghost" onClick={compute} disabled={loading || applying}>
          {loading ? "Computing…" : "Re-compute"}
        </button>
        <button type="button" className="m3dcal-btn m3dcal-btn--primary" onClick={apply} disabled={applying || loading || !proposal}>
          {applying ? "Applying…" : "Apply calibration"}
        </button>
        {applied ? <span className="m3dcal-applied">Saved ✓</span> : null}
      </div>
    </section>
  );
}
