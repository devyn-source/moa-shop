"use client";

import { useEffect, useRef, useState } from "react";
import { currency } from "@/lib/pricing";
import { DraggableArt, type ArtTransform } from "./DraggableArt";

// Woven-label "design your label" modal — logo upload, text, placement,
// label (fabric) color + thread color, live mockup. Single fold (straight sewn).
export type WovenLabel = {
  text: string;
  fold: "flat"; // single construction type (straight / sewn)
  placement: "neck" | "side-seam" | "hem";
  labelColor: string; // fabric base color (hex)
  thread: string; // woven thread color (hex)
  logoUrl?: string;
  logoName?: string;
  logoTransform?: ArtTransform; // logo position + size within the label box
};

// Logo's default position/size within the label's printable box (fractions 0..1).
const DEFAULT_LOGO_TF: ArtTransform = { ox: 0.12, oy: 0.18, sx: 0.76, sy: 0.64 };

const PLACEMENTS: { id: WovenLabel["placement"]; label: string }[] = [
  { id: "neck", label: "Inside neck" },
  { id: "side-seam", label: "Side seam" },
  { id: "hem", label: "Bottom hem" },
];
// Fabric colors for the label base.
const LABEL_COLORS = ["#FFFFFF", "#EFE9DD", "#1E1E1E", "#2B2E43", "#8A6A4F", "#C5C6C7"];
// Woven thread colors for the text/logo.
const THREADS = ["#1E1E1E", "#FFFFFF", "#B04731", "#2B2E43", "#8A6A4F", "#C5C6C7"];

export function WovenLabelModal({
  open,
  initial,
  adderUsd,
  onClose,
  onSave,
  onRemove,
}: {
  open: boolean;
  initial: WovenLabel | null;
  adderUsd: number;
  onClose: () => void;
  onSave: (label: WovenLabel) => void;
  onRemove: () => void;
}) {
  const [text, setText] = useState(initial?.text ?? "");
  const [placement, setPlacement] = useState<WovenLabel["placement"]>(initial?.placement ?? "neck");
  const [labelColor, setLabelColor] = useState(initial?.labelColor ?? "#FFFFFF");
  const [thread, setThread] = useState(initial?.thread ?? "#1E1E1E");
  const [logoUrl, setLogoUrl] = useState(initial?.logoUrl);
  const [logoName, setLogoName] = useState(initial?.logoName);
  const [logoTransform, setLogoTransform] = useState<ArtTransform>(initial?.logoTransform ?? DEFAULT_LOGO_TF);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleLogo = async (file: File | undefined | null) => {
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload-artwork", { method: "POST", body: fd });
      const data = (await res.json()) as { url?: string; error?: string; warning?: string };
      if (!res.ok || !data.url) throw new Error(data.error || "Upload failed");
      setLogoUrl(data.url);
      setLogoName(file.name);
      setLogoTransform(DEFAULT_LOGO_TF);
      setUploadMsg(data.warning ?? "Uploaded ✓");
    } catch (e) {
      setUploadMsg(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="wl-overlay" onClick={onClose}>
      <div className="wl-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Design woven label">
        <div className="wl-head">
          <div>
            <p className="wl-eyebrow">Woven label</p>
            <h2 className="wl-title">Design your label</h2>
          </div>
          <button type="button" className="wl-x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* live mockup — fixed-size fabric label tinted to the chosen fabric
            color (texture/stitching preserved); thread tints the woven text/logo
            (single-color thread). The logo is draggable + resizable within the
            label's printable box. */}
        <div className="wl-preview">
          <span className="wl-stage">
            {/* masked fabric label (the visual) */}
            <span className="wl-tag" style={{ backgroundColor: labelColor }} />
            {/* logo + drag/resize handles — a sibling overlay so the mask on the
                fabric never clips the handles */}
            <span
              className={`wl-tag-artbox${
                logoUrl && Math.abs(logoTransform.ox + logoTransform.sx / 2 - 0.5) < 0.012 ? " v-center" : ""
              }${logoUrl && Math.abs(logoTransform.oy + logoTransform.sy / 2 - 0.5) < 0.012 ? " h-center" : ""}`}
            >
              {logoUrl ? (
                <DraggableArt url={logoUrl} transform={logoTransform} onChange={setLogoTransform} maskColor={thread} snapCenter />
              ) : (
                <span className="wl-tag-text" style={{ color: thread }}>
                  {text || "YOUR BRAND"}
                </span>
              )}
            </span>
          </span>
          {logoUrl ? <span className="wl-dim">Drag a corner to resize · drag the logo to move</span> : null}
        </div>

        {/* logo upload */}
        <div className="wl-field">
          <span className="wl-label">Logo (optional)</span>
          <input ref={fileRef} type="file" accept="image/png,image/svg+xml,application/pdf,.ai,.eps" hidden onChange={(e) => handleLogo(e.target.files?.[0])} />
          <button type="button" className="wl-upload" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? "Uploading…" : logoName ? `↻ ${logoName}` : "Upload logo"}
          </button>
          <p className={`wl-hint${uploadMsg && uploadMsg !== "Uploaded ✓" ? " is-warn" : ""}`}>
            {uploadMsg ??
              "Woven labels are ~2 × 1 in. Use a vector (SVG / AI / PDF) or a transparent PNG ≥ 1200px. Keep it simple — woven art is solid thread colors, not gradients."}
          </p>
        </div>

        <label className="wl-field">
          <span className="wl-label">Label text {logoUrl ? "(used if no logo)" : ""}</span>
          <input className="wl-input" value={text} maxLength={28} onChange={(e) => setText(e.target.value)} placeholder="Your brand name" />
        </label>

        <div className="wl-field">
          <span className="wl-label">Placement</span>
          <div className="wl-pills">
            {PLACEMENTS.map((p) => (
              <button key={p.id} type="button" className={`wl-pill${placement === p.id ? " is-on" : ""}`} onClick={() => setPlacement(p.id)}>{p.label}</button>
            ))}
          </div>
        </div>

        <div className="wl-field">
          <span className="wl-label">Label color</span>
          <div className="wl-threads">
            {LABEL_COLORS.map((c) => (
              <button key={c} type="button" className={`wl-thread${labelColor === c ? " is-on" : ""}`} style={{ background: c }} onClick={() => setLabelColor(c)} aria-label={c} />
            ))}
          </div>
        </div>

        <div className="wl-field">
          <span className="wl-label">Thread color</span>
          <div className="wl-threads">
            {THREADS.map((t) => (
              <button key={t} type="button" className={`wl-thread${thread === t ? " is-on" : ""}`} style={{ background: t }} onClick={() => setThread(t)} aria-label={t} />
            ))}
          </div>
        </div>

        <div className="wl-foot">
          <span className="wl-price">+{currency(adderUsd)}/unit</span>
          <div className="wl-actions">
            {initial ? <button type="button" className="wl-remove" onClick={onRemove}>Remove</button> : null}
            <button
              type="button"
              className="wl-add"
              disabled={!text.trim() && !logoUrl}
              onClick={() => onSave({ text: text.trim(), fold: "flat", placement, labelColor, thread, logoUrl, logoName, logoTransform: logoUrl ? logoTransform : undefined })}
            >
              {initial ? "Update label" : "Add to order →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
