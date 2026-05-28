"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { calculateOrderPrice, currency } from "@/lib/pricing";
import type { CatalogProduct } from "@/lib/types";

export function SizeMatrix({ product }: { product: CatalogProduct }) {
  const initial = Object.fromEntries(product.sizes.map((size) => [size, 0])) as Record<string, number>;
  const [qty, setQty] = useState<Record<string, number>>(initial);

  const total = useMemo(() => Object.values(qty).reduce((sum, value) => sum + (value || 0), 0), [qty]);
  const price = useMemo(
    () => calculateOrderPrice(product, Math.max(total, product.moq), product.decorations[0]?.id ?? "screen_print"),
    [product, total]
  );

  const activeTierIndex = product.priceTiers.findIndex(
    (tier) => total >= tier.minQty && (tier.maxQty == null || total <= tier.maxQty)
  );
  const belowMoq = total > 0 && total < product.moq;
  const cheapest = product.priceTiers[product.priceTiers.length - 1];
  const nextTier =
    activeTierIndex >= 0 && activeTierIndex < product.priceTiers.length - 1
      ? product.priceTiers[activeTierIndex + 1]
      : null;
  const unitsToNextTier = nextTier ? Math.max(0, nextTier.minQty - total) : 0;

  function setSizeQty(size: string, value: number) {
    setQty((prev) => ({ ...prev, [size]: Math.max(0, Math.floor(value || 0)) }));
  }

  function fillEven() {
    const per = Math.ceil(product.moq / product.sizes.length);
    const fill = Object.fromEntries(product.sizes.map((size) => [size, per])) as Record<string, number>;
    setQty(fill);
  }

  function reset() {
    setQty(initial);
  }

  const params = new URLSearchParams();
  params.set("qty", String(Math.max(total, product.moq)));
  Object.entries(qty).forEach(([size, value]) => {
    if (value > 0) params.set(`size_${size}`, String(value));
  });

  return (
    <div className="size-matrix panel">
      <div className="size-matrix-head">
        <div>
          <p className="eyebrow">Order by size</p>
          <h2>Build your run</h2>
        </div>
        <div className="size-matrix-actions">
          <button type="button" className="ghost-button" onClick={fillEven}>Fill MOQ even</button>
          <button type="button" className="ghost-button" onClick={reset}>Clear</button>
        </div>
      </div>

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
                value={qty[size] ?? 0}
                onChange={(event) => setSizeQty(size, Number(event.target.value))}
                aria-label={`${size} quantity`}
              />
            </div>
          ))}
          <div className="size-cell size-cell--total" role="cell">
            <b>{total.toLocaleString()}</b>
          </div>
        </div>
        <div className="size-table-row size-table-row--unit" role="row">
          <div className="size-cell size-cell--label" role="cell">Unit price</div>
          {product.sizes.map((size) => (
            <div key={size} className="size-cell size-cell--muted" role="cell">
              {currency(price.perUnitUsd)}
            </div>
          ))}
          <div className="size-cell size-cell--total size-cell--strong" role="cell">
            {currency(price.subtotalUsd)}
          </div>
        </div>
      </div>

      <div className="size-matrix-foot">
        <div className="size-matrix-status">
          {total === 0 ? (
            <p className="size-msg">Enter quantities by size. MOQ {product.moq}.</p>
          ) : belowMoq ? (
            <p className="size-msg size-msg--warn">
              {product.moq - total} units below MOQ. Add {product.moq - total} more to qualify.
            </p>
          ) : nextTier ? (
            <p className="size-msg size-msg--ok">
              {unitsToNextTier} units to {currency(nextTier.perUnitUsd)}/unit tier.
            </p>
          ) : (
            <p className="size-msg size-msg--ok">
              Best tier reached: {currency(cheapest.perUnitUsd)}/unit.
            </p>
          )}
          <div className="size-tier-list">
            {product.priceTiers.map((tier, idx) => (
              <span
                key={tier.minQty}
                className={`size-tier-pill${idx === activeTierIndex && !belowMoq ? " size-tier-pill--active" : ""}`}
              >
                {tier.minQty}{tier.maxQty ? `–${tier.maxQty}` : "+"} · {currency(tier.perUnitUsd)}
              </span>
            ))}
          </div>
        </div>
        <div className="size-matrix-cta">
          <div className="size-total-block">
            <span className="from-label">Total order</span>
            <strong className="from-price">{currency(price.totalUsd)}</strong>
            <span className="from-unit">{Math.max(total, product.moq).toLocaleString()} units · before decoration</span>
          </div>
          <Link
            className={`button button--lg${belowMoq ? " button--disabled" : ""}`}
            href={`/p/${product.slug}/configure?${params.toString()}`}
            aria-disabled={belowMoq}
          >
            Configure order →
          </Link>
        </div>
      </div>
    </div>
  );
}
