"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { GarmentPassport } from "@/lib/garment-spec";

// Capture-and-lock editor for a Garment Passport. MOA fills the real BOM /
// construction / labels values (from the factory), confirms each (clears the
// "assumed" flag), resolves the open questions, then LOCKS it (status=approved).
// A passport can only be locked when nothing is assumed and no questions remain.
export function SpecEditor({ slug, initial }: { slug: string; initial: GarmentPassport }) {
  const router = useRouter();
  const [p, setP] = useState<GarmentPassport>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const assumed = useMemo(
    () =>
      p.bom.filter((r) => r._assumed).length +
      p.construction.filter((r) => r._assumed).length +
      (p.labelsPackaging._assumed ? 1 : 0),
    [p]
  );
  const questions = p.openQuestions.length;
  const canLock = assumed === 0 && questions === 0;

  const setBom = (i: number, k: string, v: unknown) =>
    setP((s) => ({ ...s, bom: s.bom.map((r, j) => (j === i ? { ...r, [k]: v } : r)) }));
  const setCon = (i: number, k: string, v: unknown) =>
    setP((s) => ({ ...s, construction: s.construction.map((r, j) => (j === i ? { ...r, [k]: v } : r)) }));
  const setLab = (k: string, v: unknown) => setP((s) => ({ ...s, labelsPackaging: { ...s.labelsPackaging, [k]: v } }));
  const resolveQ = (i: number) => setP((s) => ({ ...s, openQuestions: s.openQuestions.filter((_, j) => j !== i) }));

  async function save(approve: boolean) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/specs/${slug}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ spec: p, approve })
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Save failed");
      setMsg(approve ? "Locked ✓ — set in stone." : "Saved.");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="spec-ed">
      <div className="spec-ed-head">
        <div>
          <p className="eyebrow" style={{ color: "var(--color-terracotta)" }}>Garment Passport · {slug}</p>
          <h1 className="page-title">{p.styleName}</h1>
        </div>
        <div className={`spec-status spec-status--${p._status ?? "draft"}`}>{p._status ?? "draft"}</div>
      </div>

      <div className="spec-burden">
        <span className={assumed === 0 ? "ok" : "warn"}>{assumed} field{assumed === 1 ? "" : "s"} to confirm</span>
        <span className={questions === 0 ? "ok" : "warn"}>{questions} open question{questions === 1 ? "" : "s"}</span>
        <span className="spec-burden-note">Lock enables at 0 / 0</span>
      </div>

      {/* Open questions */}
      {questions > 0 && (
        <section className="spec-sec">
          <h2>Confirm before release</h2>
          {p.openQuestions.map((q, i) => (
            <div className="spec-q" key={i}>
              <span>{q}</span>
              <button type="button" onClick={() => resolveQ(i)} className="spec-resolve">Resolved ✓</button>
            </div>
          ))}
        </section>
      )}

      {/* BOM */}
      <section className="spec-sec">
        <h2>Bill of materials</h2>
        {p.bom.map((r, i) => (
          <div className={`spec-row${r._assumed ? " is-draft" : ""}`} key={i}>
            <input className="spec-strong" value={r.component} onChange={(e) => setBom(i, "component", e.target.value)} placeholder="Component" />
            <input value={r.spec} onChange={(e) => setBom(i, "spec", e.target.value)} placeholder="Spec / material" />
            <input value={r.composition} onChange={(e) => setBom(i, "composition", e.target.value)} placeholder="Composition" />
            <input value={r.weightGsm ?? ""} onChange={(e) => setBom(i, "weightGsm", e.target.value ? Number(e.target.value) : null)} placeholder="gsm" style={{ width: 56 }} />
            <input value={r.pantoneTcx} onChange={(e) => setBom(i, "pantoneTcx", e.target.value)} placeholder="TCX" style={{ width: 78 }} />
            <input value={r.supplier} onChange={(e) => setBom(i, "supplier", e.target.value)} placeholder="Supplier" />
            <label className="spec-confirm"><input type="checkbox" checked={!r._assumed} onChange={(e) => setBom(i, "_assumed", !e.target.checked)} /> confirmed</label>
          </div>
        ))}
      </section>

      {/* Construction */}
      <section className="spec-sec">
        <h2>Construction</h2>
        {p.construction.map((r, i) => (
          <div className={`spec-row${r._assumed ? " is-draft" : ""}`} key={i}>
            <input className="spec-strong" value={r.area} onChange={(e) => setCon(i, "area", e.target.value)} placeholder="Area" />
            <input value={r.detail} onChange={(e) => setCon(i, "detail", e.target.value)} placeholder="Detail" />
            <input value={r.stitch} onChange={(e) => setCon(i, "stitch", e.target.value)} placeholder="Stitch" />
            <input value={r.spi ?? ""} onChange={(e) => setCon(i, "spi", e.target.value ? Number(e.target.value) : null)} placeholder="SPI" style={{ width: 56 }} />
            <input value={r.seamClass} onChange={(e) => setCon(i, "seamClass", e.target.value)} placeholder="Seam" style={{ width: 78 }} />
            <label className="spec-confirm"><input type="checkbox" checked={!r._assumed} onChange={(e) => setCon(i, "_assumed", !e.target.checked)} /> confirmed</label>
          </div>
        ))}
      </section>

      {/* Labels & packaging */}
      <section className="spec-sec">
        <h2>Labels &amp; packaging</h2>
        {(["mainLabel", "careLabel", "sizeLabel", "hangTag", "fold", "polybag"] as const).map((k) => (
          <div className="spec-lab" key={k}>
            <span className="spec-lab-key">{k}</span>
            <input value={(p.labelsPackaging[k] as string) ?? ""} onChange={(e) => setLab(k, e.target.value)} />
          </div>
        ))}
        <label className="spec-confirm" style={{ marginTop: 8 }}>
          <input type="checkbox" checked={!p.labelsPackaging._assumed} onChange={(e) => setLab("_assumed", !e.target.checked)} /> labels confirmed
        </label>
      </section>

      <div className="spec-actions">
        <button type="button" className="secondary-button" disabled={busy} onClick={() => save(false)}>Save draft</button>
        <button type="button" className="button" disabled={busy || !canLock} onClick={() => save(true)}>
          {canLock ? "Lock — set in stone →" : `Resolve ${assumed + questions} to lock`}
        </button>
        {msg && <span className="spec-msg">{msg}</span>}
      </div>
      <p className="spec-note">Size chart comes straight from the stored factory grading (product_zones) — edit it in /admin/zones, not here.</p>
    </div>
  );
}
