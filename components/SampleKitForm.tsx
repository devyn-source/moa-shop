"use client";

import { useState } from "react";
import { analytics } from "@/lib/analytics";

// Sample-kit request form (premium-form thesis: borderless inputs, terracotta
// accent, no quote-wall friction — just enough to qualify and ship).
export function SampleKitForm({ options }: { options: { slug: string; name: string }[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const toggle = (slug: string) =>
    setSelected((s) => (s.includes(slug) ? s.filter((x) => x !== slug) : [...s, slug]));

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const f = new FormData(e.currentTarget);
    const body = {
      contactName: String(f.get("contactName") || ""),
      contactEmail: String(f.get("contactEmail") || ""),
      companyName: String(f.get("companyName") || ""),
      roleTitle: String(f.get("roleTitle") || "") || undefined,
      shipTo: {
        line1: String(f.get("line1") || ""),
        line2: String(f.get("line2") || "") || undefined,
        city: String(f.get("city") || ""),
        state: String(f.get("state") || "") || undefined,
        postalCode: String(f.get("postalCode") || ""),
        country: String(f.get("country") || ""),
      },
      interestedSlugs: selected,
      estQuantity: String(f.get("estQuantity") || "") || undefined,
      timeline: String(f.get("timeline") || "") || undefined,
      notes: String(f.get("notes") || "") || undefined,
    };
    try {
      const res = await fetch("/api/samples", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || "Couldn't submit the request. Please check the fields and try again.");
        setSubmitting(false);
        return;
      }
      analytics.track("sample_kit_requested", { count: selected.length });
      setDone(true);
    } catch {
      setError("Couldn't submit the request. Please try again.");
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="empty-state" style={{ maxWidth: 560 }}>
        <p style={{ fontWeight: 600, color: "var(--color-charcoal)" }}>Request received.</p>
        <p>
          A real person reviews every kit — you&apos;ll hear from us at the email you provided,
          usually within one business day.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="config-form" style={{ maxWidth: 720 }}>
      <div className="form-grid">
        <label className="field">
          <span className="label">Your name *</span>
          <input name="contactName" required maxLength={120} autoComplete="name" />
        </label>
        <label className="field">
          <span className="label">Work email *</span>
          <input name="contactEmail" type="email" required maxLength={254} autoComplete="email" />
        </label>
        <label className="field">
          <span className="label">Company *</span>
          <input name="companyName" required maxLength={160} autoComplete="organization" />
        </label>
        <label className="field">
          <span className="label">Role</span>
          <input name="roleTitle" maxLength={120} autoComplete="organization-title" />
        </label>
      </div>

      <div className="field full" style={{ marginTop: 18 }}>
        <span className="label">What are you considering?</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {options.map((o) => (
            <button
              key={o.slug}
              type="button"
              onClick={() => toggle(o.slug)}
              aria-pressed={selected.includes(o.slug)}
              style={{
                padding: "7px 14px",
                borderRadius: 999,
                fontSize: "0.72rem",
                fontWeight: 600,
                cursor: "pointer",
                border: selected.includes(o.slug)
                  ? "1px solid var(--color-terracotta)"
                  : "1px solid var(--color-cream-dark)",
                background: selected.includes(o.slug) ? "rgba(176,71,49,0.08)" : "var(--color-white, #fff)",
                color: selected.includes(o.slug) ? "var(--color-terracotta)" : "var(--color-charcoal)",
              }}
            >
              {o.name}
            </button>
          ))}
        </div>
      </div>

      <div className="form-grid" style={{ marginTop: 18 }}>
        <label className="field">
          <span className="label">Estimated quantity</span>
          <select name="estQuantity" defaultValue="">
            <option value="">Not sure yet</option>
            <option>50–100 units</option>
            <option>100–250 units</option>
            <option>250–500 units</option>
            <option>500+ units</option>
          </select>
        </label>
        <label className="field">
          <span className="label">Timeline</span>
          <select name="timeline" defaultValue="">
            <option value="">Not sure yet</option>
            <option>ASAP</option>
            <option>1–2 months</option>
            <option>This quarter</option>
            <option>Exploring</option>
          </select>
        </label>
      </div>

      <div className="form-grid" style={{ marginTop: 18 }}>
        <label className="field full">
          <span className="label">Shipping address — line 1 *</span>
          <input name="line1" required maxLength={200} autoComplete="address-line1" />
        </label>
        <label className="field full">
          <span className="label">Line 2</span>
          <input name="line2" maxLength={200} autoComplete="address-line2" />
        </label>
        <label className="field">
          <span className="label">City *</span>
          <input name="city" required maxLength={120} autoComplete="address-level2" />
        </label>
        <label className="field">
          <span className="label">State / region</span>
          <input name="state" maxLength={120} autoComplete="address-level1" />
        </label>
        <label className="field">
          <span className="label">Postal code *</span>
          <input name="postalCode" required maxLength={20} autoComplete="postal-code" />
        </label>
        <label className="field">
          <span className="label">Country *</span>
          <input name="country" required maxLength={120} autoComplete="country-name" defaultValue="United States" />
        </label>
        <label className="field full">
          <span className="label">Anything else?</span>
          <textarea name="notes" maxLength={2000} rows={3} placeholder="Event date, brand context, links…" />
        </label>
      </div>

      {error ? <p className="form-error" style={{ marginTop: 14 }}>{error}</p> : null}
      <button className="button button--lg" type="submit" disabled={submitting} style={{ marginTop: 18 }}>
        {submitting ? "Sending…" : "Request the kit"}
      </button>
      <p className="trust-note" style={{ marginTop: 10 }}>
        Kits are reviewed by a real person and ship within a few business days.
      </p>
    </form>
  );
}
