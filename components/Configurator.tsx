"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { calculateOrderPrice, currency } from "@/lib/pricing";
import type { CatalogProduct, DecorationMethod } from "@/lib/types";
import { ProductShot } from "./ProductShot";

const STEPS = [
  { id: 1, label: "Variant" },
  { id: 2, label: "Decoration" },
  { id: 3, label: "Artwork" },
  { id: 4, label: "Checkout" }
] as const;

export function Configurator({
  product,
  initialSizes
}: {
  product: CatalogProduct;
  initialSizes?: Record<string, number>;
}) {
  const router = useRouter();
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? "");
  const [decorationId, setDecorationId] = useState<DecorationMethod>(product.decorations[0]?.id ?? "screen_print");
  const [sizeQty, setSizeQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(product.sizes.map((size) => [size, initialSizes?.[size] ?? 0]))
  );
  const [fileName, setFileName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const total = useMemo(
    () => Object.values(sizeQty).reduce((sum, value) => sum + (value || 0), 0),
    [sizeQty]
  );
  const belowMoq = total < product.moq;

  const variant = product.variants.find((item) => item.id === variantId) ?? product.variants[0];
  const decoration = product.decorations.find((item) => item.id === decorationId) ?? product.decorations[0];
  const price = useMemo(
    () => calculateOrderPrice(product, total, decorationId),
    [product, total, decorationId]
  );

  const activeTierIndex = useMemo(
    () =>
      product.priceTiers.findIndex(
        (tier) => total >= tier.minQty && (tier.maxQty == null || total <= tier.maxQty)
      ),
    [product, total]
  );

  function setSize(size: string, value: number) {
    setSizeQty((prev) => ({ ...prev, [size]: Math.max(0, Math.floor(value || 0)) }));
  }

  function fillEven() {
    const per = Math.ceil(product.moq / product.sizes.length);
    setSizeQty(Object.fromEntries(product.sizes.map((size) => [size, per])));
  }

  function clearSizes() {
    setSizeQty(Object.fromEntries(product.sizes.map((size) => [size, 0])));
  }

  const sizeSummary = product.sizes
    .filter((size) => (sizeQty[size] ?? 0) > 0)
    .map((size) => `${size}:${sizeQty[size]}`)
    .join(" ");

  async function submit(formData: FormData) {
    if (belowMoq) {
      setError(`Order is below the ${product.moq}-unit minimum. Add ${product.moq - total} more.`);
      return;
    }
    setSubmitting(true);
    setError("");

    const notes = String(formData.get("artworkNotes") ?? "");
    const payload = {
      contactName: String(formData.get("contactName") ?? ""),
      contactEmail: String(formData.get("contactEmail") ?? ""),
      contactPhone: String(formData.get("contactPhone") ?? ""),
      companyName: String(formData.get("companyName") ?? ""),
      productId: product.id,
      variantId,
      decorationId,
      quantity: total,
      artworkFileName: fileName || "Artwork file pending",
      artworkNotes: sizeSummary ? `Sizes — ${sizeSummary}${notes ? `\n\n${notes}` : ""}` : notes,
      shipToName: String(formData.get("shipToName") ?? ""),
      shipToAddress: {
        line1: String(formData.get("line1") ?? ""),
        line2: String(formData.get("line2") ?? ""),
        city: String(formData.get("city") ?? ""),
        state: String(formData.get("state") ?? ""),
        postalCode: String(formData.get("postalCode") ?? ""),
        country: String(formData.get("country") ?? "United States")
      }
    };

    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      setSubmitting(false);
      setError("Order could not be created. Check the required fields and try again.");
      return;
    }

    const order = (await response.json()) as { id: string };
    router.push(`/orders/${order.id}`);
  }

  return (
    <div className="config-shell">
      <form action={submit} className="config-form" id="config-form">
        <div className="config-head">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/">Catalog</Link>
            <span aria-hidden>/</span>
            <Link href={`/p/${product.slug}`}>{product.displayName}</Link>
            <span aria-hidden>/</span>
            <span className="crumb-current">Configure</span>
          </nav>
          <p className="eyebrow">Configure</p>
          <h1 className="page-title">{product.displayName}</h1>
          <p className="lede">{product.headline}</p>

          <ol className="stepper" aria-label="Order steps">
            {STEPS.map((step) => (
              <li key={step.id} className="step">
                <span className="step-num">{String(step.id).padStart(2, "0")}</span>
                <span className="step-label">{step.label}</span>
              </li>
            ))}
          </ol>
        </div>

        <section className="step-block">
          <header className="step-block-head">
            <span className="step-pill">01</span>
            <h2>Choose variant</h2>
          </header>
          <div className="tile-grid">
            {product.variants.map((item) => {
              const selected = variantId === item.id;
              return (
                <button
                  type="button"
                  className={`tile${selected ? " tile--active" : ""}`}
                  key={item.id}
                  onClick={() => setVariantId(item.id)}
                  aria-pressed={selected}
                >
                  <span className="tile-swatch" style={{ background: item.colorHex }} />
                  <span className="tile-body">
                    <strong>{item.colorLabel}</strong>
                    <span className="tile-sub">{item.label} · {item.fabric}</span>
                  </span>
                  {selected ? <span className="tile-check" aria-hidden>✓</span> : null}
                </button>
              );
            })}
          </div>
        </section>

        <section className="step-block">
          <header className="step-block-head">
            <span className="step-pill">02</span>
            <h2>Decoration method</h2>
          </header>
          <div className="tile-grid tile-grid--wide">
            {product.decorations.map((item) => {
              const selected = decorationId === item.id;
              return (
                <button
                  type="button"
                  className={`tile${selected ? " tile--active" : ""}`}
                  key={item.id}
                  onClick={() => setDecorationId(item.id)}
                  aria-pressed={selected}
                >
                  <span className="tile-body">
                    <strong>{item.label}</strong>
                    <span className="tile-sub">{item.description}</span>
                    <span className="zone-list">{item.placementZones.slice(0, 4).join(" · ")}</span>
                  </span>
                  <span className="adder-pill">+{currency(item.perUnitAdderUsd)}/unit</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="step-block">
          <header className="step-block-head">
            <span className="step-pill">03</span>
            <h2>Build your run</h2>
            <div className="size-matrix-actions">
              <button type="button" className="ghost-button" onClick={fillEven}>Fill MOQ even</button>
              <button type="button" className="ghost-button" onClick={clearSizes}>Clear</button>
            </div>
          </header>

          <div className="size-table" role="table">
            <div className="size-table-row size-table-row--head" role="row">
              <div className="size-cell size-cell--label" role="columnheader">Size</div>
              {product.sizes.map((size) => (
                <div key={size} className="size-cell size-cell--size" role="columnheader">{size}</div>
              ))}
              <div className="size-cell size-cell--total" role="columnheader">Total</div>
            </div>
            <div className="size-table-row" role="row">
              <div className="size-cell size-cell--label" role="cell">Quantity</div>
              {product.sizes.map((size) => (
                <div key={size} className="size-cell" role="cell">
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={sizeQty[size] ?? 0}
                    onChange={(event) => setSize(size, Number(event.target.value))}
                    aria-label={`${size} quantity`}
                  />
                </div>
              ))}
              <div className="size-cell size-cell--total" role="cell"><b>{total.toLocaleString()}</b></div>
            </div>
            <div className="size-table-row size-table-row--unit" role="row">
              <div className="size-cell size-cell--label" role="cell">Unit price</div>
              {product.sizes.map((size) => (
                <div key={size} className="size-cell size-cell--muted" role="cell">{currency(price.perUnitUsd)}</div>
              ))}
              <div className="size-cell size-cell--total size-cell--strong" role="cell">{currency(price.subtotalUsd)}</div>
            </div>
          </div>

          {belowMoq ? (
            <p className="size-msg size-msg--warn">
              {total === 0
                ? `Enter quantities by size. MOQ ${product.moq}.`
                : `${product.moq - total} units below MOQ — add ${product.moq - total} more to qualify.`}
            </p>
          ) : (
            <p className="size-msg size-msg--ok">MOQ met. Current tier: {currency(price.perUnitUsd)}/unit.</p>
          )}

          <div className="tier-list tier-list--inline">
            {product.priceTiers.map((tier, idx) => (
              <div
                key={tier.minQty}
                className={`tier-row${idx === activeTierIndex && !belowMoq ? " tier-row--active" : ""}`}
              >
                <span>
                  {tier.minQty}{tier.maxQty ? `–${tier.maxQty}` : "+"} units
                </span>
                <strong>{currency(tier.perUnitUsd)}/unit</strong>
              </div>
            ))}
          </div>

          <div className="form-grid" style={{ marginTop: 16 }}>
            <div className="field">
              <span className="label">Mockup template</span>
              <a className="secondary-button" href={variant?.mockupTemplateUrl ?? "#"} target="_blank">
                Download {variant?.colorLabel ?? "variant"} template
              </a>
            </div>
            <label className="field">
              <span className="label">Upload completed mockup</span>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.psd,.ai"
                onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
              />
              {fileName ? <span className="file-chip">📎 {fileName}</span> : null}
            </label>
            <label className="field full">
              <span className="label">Artwork notes</span>
              <textarea name="artworkNotes" placeholder="Placement notes, Pantones, file context, or anything Amanda should verify." />
            </label>
          </div>
        </section>

        <section className="step-block">
          <header className="step-block-head">
            <span className="step-pill">04</span>
            <h2>Contact + ship-to</h2>
          </header>
          <div className="form-grid">
            <label className="field">
              <span className="label">Contact name</span>
              <input name="contactName" required />
            </label>
            <label className="field">
              <span className="label">Email</span>
              <input name="contactEmail" type="email" required />
            </label>
            <label className="field">
              <span className="label">Phone</span>
              <input name="contactPhone" required />
            </label>
            <label className="field">
              <span className="label">Company</span>
              <input name="companyName" required />
            </label>
            <label className="field">
              <span className="label">Ship-to name</span>
              <input name="shipToName" required />
            </label>
            <label className="field">
              <span className="label">Address line 1</span>
              <input name="line1" required />
            </label>
            <label className="field">
              <span className="label">Address line 2</span>
              <input name="line2" />
            </label>
            <label className="field">
              <span className="label">City</span>
              <input name="city" required />
            </label>
            <label className="field">
              <span className="label">State</span>
              <input name="state" required />
            </label>
            <label className="field">
              <span className="label">Postal code</span>
              <input name="postalCode" required />
            </label>
            <label className="field">
              <span className="label">Country</span>
              <input name="country" defaultValue="United States" required />
            </label>
          </div>

          {error ? <p className="form-error">{error}</p> : null}
        </section>
      </form>

      <aside className="price-box panel">
        <div className="price-box-pad">
          <div className={`price-box-visual${variant?.frontImage ? " price-box-visual--photo" : ""}`}>
            <ProductShot product={product} variant={variant} view="front" />
            <span className="visual-meta">{variant?.colorLabel}</span>
          </div>

          <p className="eyebrow">Live total</p>
          <div className="price-total-big">
            <span className="price-total-num">{currency(price.totalUsd)}</span>
            <span className="price-total-sub">{price.quantity.toLocaleString()} units · {decoration?.label}</span>
          </div>

          <div className="price-stack">
            <div className="price-line">
              <span>Base unit</span>
              <strong>{currency(price.perUnitUsd)}</strong>
            </div>
            <div className="price-line">
              <span>Decoration adder</span>
              <strong>+{currency(price.decorationAdderUsd)}</strong>
            </div>
            <div className="price-line">
              <span>Per unit total</span>
              <strong>{currency(price.perUnitUsd + price.decorationAdderUsd)}</strong>
            </div>
            <div className="price-line">
              <span>Quantity</span>
              <strong>{price.quantity.toLocaleString()}</strong>
            </div>
            <div className="price-line">
              <span>Subtotal</span>
              <strong>{currency(price.subtotalUsd)}</strong>
            </div>
            <div className="price-line">
              <span>Tax</span>
              <strong>{currency(price.taxUsd)}</strong>
            </div>
          </div>

          <button
            className="button button--lg button--full"
            disabled={submitting || belowMoq}
            type="submit"
            form="config-form"
          >
            {submitting
              ? "Creating order…"
              : belowMoq
                ? `Add ${product.moq - total} more (MOQ ${product.moq})`
                : `Pay ${currency(price.totalUsd)}`}
          </button>
          <p className="trust-note">
            Simulated Stripe checkout. 100% upfront. Amanda reviews artwork before vendor handoff.
          </p>
        </div>
      </aside>
    </div>
  );
}
