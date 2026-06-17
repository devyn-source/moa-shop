"use client";

import { useRef, useState } from "react";
import Garment3DClient from "./Garment3DClient";
import type { SignedPatternFile } from "@/lib/pattern-files";

type Swatch = { label: string; hex: string };

function fmtBytes(n: number): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// Per-SKU production assets back-office: gated CAD pattern files (DXF/AI/PLT) +
// the public 3D model (GLB). Mutations hit /api/admin/* (Basic Auth via proxy).
export default function AssetManager({
  slug,
  displayName,
  skuCode,
  initialPatternFiles,
  initialModelUrl,
  swatches,
}: {
  slug: string;
  displayName: string;
  skuCode: string;
  initialPatternFiles: SignedPatternFile[];
  initialModelUrl: string | null;
  swatches: Swatch[];
}) {
  const [files, setFiles] = useState<SignedPatternFile[]>(initialPatternFiles);
  const [modelUrl, setModelUrl] = useState<string | null>(initialModelUrl);
  const [patternBusy, setPatternBusy] = useState(false);
  const [modelBusy, setModelBusy] = useState(false);
  const [patternErr, setPatternErr] = useState<string | null>(null);
  const [modelErr, setModelErr] = useState<string | null>(null);
  const [dragPattern, setDragPattern] = useState(false);
  const patternInput = useRef<HTMLInputElement>(null);
  const modelInput = useRef<HTMLInputElement>(null);

  const uploadPattern = async (file: File | undefined | null) => {
    if (!file) return;
    setPatternErr(null);
    setPatternBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/upload-pattern/${slug}`, { method: "POST", body: fd });
      const data = (await res.json()) as { files?: SignedPatternFile[]; error?: string };
      if (!res.ok || !data.files) throw new Error(data.error || "Upload failed");
      setFiles(data.files);
    } catch (e) {
      setPatternErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setPatternBusy(false);
      if (patternInput.current) patternInput.current.value = "";
    }
  };

  const deletePattern = async (path: string) => {
    setPatternErr(null);
    setPatternBusy(true);
    try {
      const res = await fetch(`/api/admin/upload-pattern/${slug}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path }),
      });
      const data = (await res.json()) as { files?: SignedPatternFile[]; error?: string };
      if (!res.ok || !data.files) throw new Error(data.error || "Delete failed");
      setFiles(data.files);
    } catch (e) {
      setPatternErr(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setPatternBusy(false);
    }
  };

  const uploadModel = async (file: File | undefined | null) => {
    if (!file) return;
    setModelErr(null);
    setModelBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/upload-model/${slug}`, { method: "POST", body: fd });
      const data = (await res.json()) as { url?: string | null; error?: string };
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setModelUrl(data.url ?? null);
    } catch (e) {
      setModelErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setModelBusy(false);
      if (modelInput.current) modelInput.current.value = "";
    }
  };

  const deleteModel = async () => {
    setModelErr(null);
    setModelBusy(true);
    try {
      const res = await fetch(`/api/admin/upload-model/${slug}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Delete failed");
      }
      setModelUrl(null);
    } catch (e) {
      setModelErr(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setModelBusy(false);
    }
  };

  return (
    <div className="assetmgr">
      <header className="assetmgr-head">
        <p className="eyebrow">Production assets</p>
        <h1 className="page-title">{displayName}</h1>
        <p className="assetmgr-sub">Style {skuCode} · <code>{slug}</code></p>
      </header>

      <div className="assetmgr-grid">
        {/* --- Pattern files (gated: MOA + vendor only) --- */}
        <section className="assetmgr-card">
          <div className="assetmgr-card-head">
            <h2>Pattern files</h2>
            <span className="assetmgr-tag assetmgr-tag--gated">MOA + vendor only</span>
          </div>
          <p className="assetmgr-note">
            CAD cut patterns (DXF, AI, PLT). Stored privately and attached to the vendor PO email when this style is ordered.
          </p>

          <input
            ref={patternInput}
            type="file"
            accept=".dxf,.ai,.plt"
            hidden
            onChange={(e) => uploadPattern(e.target.files?.[0])}
          />
          <button
            type="button"
            className={`assetmgr-drop${dragPattern ? " is-drag" : ""}`}
            disabled={patternBusy}
            onClick={() => patternInput.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragPattern(true); }}
            onDragLeave={() => setDragPattern(false)}
            onDrop={(e) => { e.preventDefault(); setDragPattern(false); uploadPattern(e.dataTransfer.files?.[0]); }}
          >
            {patternBusy ? "Working…" : "Upload pattern file"}
            <span className="assetmgr-drop-hint">DXF · AI · PLT — 50 MB max</span>
          </button>
          {patternErr ? <p className="assetmgr-err">⚠ {patternErr}</p> : null}

          {files.length ? (
            <ul className="assetmgr-files">
              {files.map((f) => (
                <li key={f.path} className="assetmgr-file">
                  <span className={`assetmgr-fmt assetmgr-fmt--${f.format}`}>{f.format.toUpperCase()}</span>
                  <span className="assetmgr-file-meta">
                    <strong>{f.filename}</strong>
                    <em>{fmtBytes(f.bytes)}</em>
                  </span>
                  <a className="assetmgr-link" href={f.url} target="_blank" rel="noreferrer">Download ↓</a>
                  <button type="button" className="assetmgr-x" onClick={() => deletePattern(f.path)} disabled={patternBusy} aria-label={`Delete ${f.filename}`}>✕</button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="assetmgr-empty">No pattern files yet.</p>
          )}
        </section>

        {/* --- 3D model (public: rendered on the PDP) --- */}
        <section className="assetmgr-card">
          <div className="assetmgr-card-head">
            <h2>3D model</h2>
            <span className="assetmgr-tag assetmgr-tag--public">Public · on PDP</span>
          </div>
          <p className="assetmgr-note">
            One GLB per style. Rendered as the rotatable PDP viewer; customers can download a still.
          </p>

          <input
            ref={modelInput}
            type="file"
            accept=".glb,model/gltf-binary"
            hidden
            onChange={(e) => uploadModel(e.target.files?.[0])}
          />

          {modelUrl ? (
            <div className="assetmgr-3d">
              <Garment3DClient url={modelUrl} swatches={swatches.length ? swatches : [{ label: "Default", hex: "#2D2C2F" }]} />
            </div>
          ) : (
            <div className="assetmgr-3d-empty">No 3D model uploaded for this style.</div>
          )}

          <div className="assetmgr-3d-actions">
            <button type="button" className="assetmgr-drop assetmgr-drop--inline" disabled={modelBusy} onClick={() => modelInput.current?.click()}>
              {modelBusy ? "Working…" : modelUrl ? "Replace model" : "Upload GLB"}
            </button>
            {modelUrl ? (
              <button type="button" className="assetmgr-x assetmgr-x--btn" disabled={modelBusy} onClick={deleteModel}>Remove</button>
            ) : null}
          </div>
          {modelErr ? <p className="assetmgr-err">⚠ {modelErr}</p> : null}
        </section>
      </div>
    </div>
  );
}
