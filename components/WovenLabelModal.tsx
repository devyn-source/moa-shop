"use client";

import { useEffect, useState } from "react";
import { currency } from "@/lib/pricing";

// Woven-label upsell. A small "design your label" modal — text, fold, placement,
// thread color — with a live preview, added as a flat per-unit add-on.
export type WovenLabel = {
  text: string;
  fold: "loop" | "flat" | "end";
  placement: "neck" | "side-seam" | "hem";
  thread: string; // hex
};

const FOLDS: { id: WovenLabel["fold"]; label: string }[] = [
  { id: "loop", label: "Loop fold" },
  { id: "flat", label: "Flat / sewn" },
  { id: "end", label: "End fold" },
];
const PLACEMENTS: { id: WovenLabel["placement"]; label: string }[] = [
  { id: "neck", label: "Inside neck" },
  { id: "side-seam", label: "Side seam" },
  { id: "hem", label: "Bottom hem" },
];
const THREADS = ["#FFFFFF", "#1E1E1E", "#B04731", "#2B2E43", "#776A5F", "#C5C6C7"];

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
  const [fold, setFold] = useState<WovenLabel["fold"]>(initial?.fold ?? "loop");
  const [placement, setPlacement] = useState<WovenLabel["placement"]>(initial?.placement ?? "neck");
  const [thread, setThread] = useState(initial?.thread ?? "#FFFFFF");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const dark = thread.toUpperCase() === "#FFFFFF" || thread === "#C5C6C7";

  return (
    <div className="wl-overlay" onClick={onClose}>
      <div className="wl-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Design woven label">
        <div className="wl-head">
          <div>
            <p className="wl-eyebrow">Upsell · Woven label</p>
            <h2 className="wl-title">Design your label</h2>
          </div>
          <button type="button" className="wl-x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* live preview */}
        <div className="wl-preview" aria-hidden>
          <span className={`wl-tag wl-tag--${fold}`} style={{ background: thread, color: dark ? "#1E1E1E" : "#FFFFFF" }}>
            {text || "YOUR BRAND"}
          </span>
        </div>

        <label className="wl-field">
          <span className="wl-label">Label text</span>
          <input className="wl-input" value={text} maxLength={28} onChange={(e) => setText(e.target.value)} placeholder="Your brand name" />
        </label>

        <div className="wl-field">
          <span className="wl-label">Fold</span>
          <div className="wl-pills">
            {FOLDS.map((f) => (
              <button key={f.id} type="button" className={`wl-pill${fold === f.id ? " is-on" : ""}`} onClick={() => setFold(f.id)}>{f.label}</button>
            ))}
          </div>
        </div>

        <div className="wl-field">
          <span className="wl-label">Placement</span>
          <div className="wl-pills">
            {PLACEMENTS.map((p) => (
              <button key={p.id} type="button" className={`wl-pill${placement === p.id ? " is-on" : ""}`} onClick={() => setPlacement(p.id)}>{p.label}</button>
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
              disabled={!text.trim()}
              onClick={() => onSave({ text: text.trim(), fold, placement, thread })}
            >
              {initial ? "Update label" : "Add to order →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
