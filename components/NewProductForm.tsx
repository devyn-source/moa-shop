"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewProductForm() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function submit(formData: FormData) {
    setCreating(true);
    const response = await fetch("/api/admin/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: String(formData.get("displayName") ?? ""),
        headline: String(formData.get("headline") ?? "Draft made-to-order product."),
        moq: Number(formData.get("moq") ?? 50)
      })
    });
    const product = (await response.json()) as { slug?: string };
    setCreating(false);
    if (product.slug) {
      router.push(`/admin/catalog/${product.slug}`);
    } else {
      router.refresh();
    }
  }

  return (
    <form action={submit} className="admin-card">
      <h3>Add Draft Product</h3>
      <div className="form-grid">
        <label className="field">
          <span className="label">Name</span>
          <input name="displayName" required placeholder="Premium Quarter Zip" />
        </label>
        <label className="field">
          <span className="label">MOQ</span>
          <input name="moq" type="number" defaultValue={100} />
        </label>
        <label className="field full">
          <span className="label">Headline</span>
          <input name="headline" placeholder="Short product positioning line" />
        </label>
      </div>
      <div className="action-row">
        <button className="secondary-button" disabled={creating} type="submit">
          {creating ? "Creating..." : "Create draft"}
        </button>
      </div>
    </form>
  );
}
