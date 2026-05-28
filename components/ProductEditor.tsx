"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CatalogProduct } from "@/lib/types";

export function ProductEditor({ product }: { product: CatalogProduct }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function submit(formData: FormData) {
    setSaving(true);
    const payload = {
      displayName: String(formData.get("displayName") ?? ""),
      headline: String(formData.get("headline") ?? ""),
      description: String(formData.get("description") ?? ""),
      bestFor: String(formData.get("bestFor") ?? ""),
      moq: Number(formData.get("moq") ?? product.moq),
      leadTimeDays: Number(formData.get("leadTimeDays") ?? product.leadTimeDays),
      vendorUnitCostUsd: Number(formData.get("vendorUnitCostUsd") ?? product.vendorUnitCostUsd),
      isPublished: formData.get("isPublished") === "on"
    };

    await fetch(`/api/admin/catalog/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <form action={submit} className="panel panel-pad">
      <p className="eyebrow">Catalog Editor</p>
      <div className="form-grid">
        <label className="field">
          <span className="label">Product name</span>
          <input name="displayName" defaultValue={product.displayName} required />
        </label>
        <label className="field">
          <span className="label">Best for</span>
          <input name="bestFor" defaultValue={product.bestFor} />
        </label>
        <label className="field full">
          <span className="label">Headline</span>
          <input name="headline" defaultValue={product.headline} required />
        </label>
        <label className="field full">
          <span className="label">Description</span>
          <textarea name="description" defaultValue={product.description} required />
        </label>
        <label className="field">
          <span className="label">MOQ</span>
          <input name="moq" type="number" defaultValue={product.moq} />
        </label>
        <label className="field">
          <span className="label">Lead time days</span>
          <input name="leadTimeDays" type="number" defaultValue={product.leadTimeDays} />
        </label>
        <label className="field">
          <span className="label">Vendor unit cost</span>
          <input name="vendorUnitCostUsd" type="number" step="0.01" defaultValue={product.vendorUnitCostUsd} />
        </label>
        <label className="choice" style={{ alignSelf: "end" }}>
          <input name="isPublished" type="checkbox" defaultChecked={product.isPublished} />
          <span>Published</span>
          <span />
        </label>
      </div>
      <div className="action-row">
        <button className="button" disabled={saving} type="submit">
          {saving ? "Saving..." : "Save product"}
        </button>
      </div>
    </form>
  );
}
