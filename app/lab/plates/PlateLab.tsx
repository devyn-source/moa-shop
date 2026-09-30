"use client";
import { useEffect, useState } from "react";
import PlateComposite from "@/components/PlateComposite";
import type { PlateManifest, PlatePlacement, DecorationMethod } from "@/lib/plates";

const BASE = "/lab/plates/fixture-tee";

export default function PlateLab() {
  const [manifest, setManifest] = useState<PlateManifest | null>(null);
  const [method, setMethod] = useState<DecorationMethod>("screen_print");
  const [placements, setPlacements] = useState<PlatePlacement[]>([
    { id: "lc", artUrl: "/lab/logo.png", piece: 1, widthIn: 3.5, belowHpsIn: 7, fromCfIn: 4 },
    { id: "cc", artUrl: "/lab/back-art.png", piece: 1, widthIn: 10, belowHpsIn: 11, fromCfIn: 0 },
  ]);
  useEffect(() => { fetch(`${BASE}/manifest.json`).then((r) => r.json()).then(setManifest); }, []);
  const withMethod = placements.map((p) => ({ ...p, method }));
  return (
    <main className="page" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 32 }}>
      <div style={{ maxWidth: 720 }}>
        {manifest ? <PlateComposite base={BASE} colour="bone" view="front" manifest={manifest} placements={withMethod} onChange={setPlacements} /> : null}
      </div>
      <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p className="pdpx-place-label">Method</p>
        {(["screen_print", "embroidery", "rubber_applique"] as DecorationMethod[]).map((m) => (
          <button key={m} type="button" className={`pdpx-preset${m === method ? " is-on" : ""}`} onClick={() => setMethod(m)} data-method={m}>{m.replace("_", " ")}</button>
        ))}
        {placements.map((p) => (
          <label key={p.id} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
            {p.id} width {p.widthIn} in, {p.belowHpsIn} in below HPS, {p.fromCfIn} in from CF
            <input type="range" min={1} max={14} step={0.25} value={p.widthIn} onChange={(e) => setPlacements((all) => all.map((q) => (q.id === p.id ? { ...q, widthIn: +e.target.value } : q)))} />
          </label>
        ))}
      </aside>
    </main>
  );
}
