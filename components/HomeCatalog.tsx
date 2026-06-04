"use client";

import { useMemo, useState } from "react";
import { ProductCard } from "./ProductCard";
import { BrandSelect } from "./BrandSelect";
import type { CatalogProduct } from "@/lib/types";

const CATEGORY_LABELS: Record<string, string> = {
  hoodie: "Hoodies",
  tee: "Tees",
  knitwear: "Knitwear",
  bottoms: "Bottoms",
  outerwear: "Outerwear",
  bag: "Bags",
  headwear: "Headwear",
  accessory: "Accessories"
};

function CatIcon({ type }: { type: string }) {
  return (
    <svg
      className="cat-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {type === "hoodie" ? (
        <>
          <path d="M8 5 4.5 8 6.5 10.5V20h11v-9.5L19.5 8 16 5" />
          <path d="M8.5 5a3.5 3 0 0 0 7 0" />
          <path d="M10.5 9.5v3M13.5 9.5v3" />
          <path d="M9.5 15.5h5" />
        </>
      ) : null}
      {type === "tee" ? (
        <path d="M8 4 4 7l2 2.5V20h12V9.5L20 7l-4-3-2 1.8a3 3 0 0 1-4 0z" />
      ) : null}
      {type === "knitwear" ? (
        <>
          <path d="M8.5 4 4 8l2.5 2.5V20h11v-9.5L20 8l-4.5-4" />
          <path d="M9 4a3 3 0 0 0 6 0" />
          <path d="M6.2 17.5h2.4M15.4 17.5h2.4" />
        </>
      ) : null}
      {type === "bottoms" ? (
        <>
          <path d="M7 4h10l-.6 16h-3.2L12 9l-1.2 11H7.6z" />
          <path d="M7 6.5h10" />
        </>
      ) : null}
      {type === "outerwear" ? (
        <>
          <path d="M8 4 4 7l2 2.5V20h12V9.5L20 7l-4-3" />
          <path d="M8 4l4 2 4-2" />
          <path d="M12 6v14" />
        </>
      ) : null}
      {type === "bag" ? (
        <>
          <path d="M5.5 8h13l-1 11.5h-11z" />
          <path d="M9 8a3 3 0 0 1 6 0" />
        </>
      ) : null}
      {type === "headwear" ? (
        <>
          <path d="M5 14a7 5 0 0 1 14 0z" />
          <path d="M19 14c2.4 0 3.4 1 3.4 2H12" />
        </>
      ) : null}
    </svg>
  );
}

const MIN_ORDER_OPTIONS = [
  { value: "", label: "Any quantity" },
  { value: "lt150", label: "Under 150" },
  { value: "150-250", label: "150 – 250" },
  { value: "gt250", label: "250+" }
];

const PRICE_OPTIONS = [
  { value: "", label: "Any price" },
  { value: "lt25", label: "Under $25/unit" },
  { value: "25-75", label: "$25 – $75/unit" },
  { value: "gt75", label: "$75+/unit" }
];

export function HomeCatalog({ products }: { products: CatalogProduct[] }) {
  const [category, setCategory] = useState<string | null>(null);
  const [method, setMethod] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [priceRange, setPriceRange] = useState("");
  const [query, setQuery] = useState("");

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const product of products) map.set(product.category, (map.get(product.category) ?? 0) + 1);
    return Array.from(map.entries());
  }, [products]);

  const methodOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const product of products) {
      for (const decoration of product.decorations) map.set(decoration.id, decoration.label);
    }
    return [{ value: "", label: "Choose" }, ...Array.from(map.entries()).map(([value, label]) => ({ value, label }))];
  }, [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((product) => {
      if (category && product.category !== category) return false;
      if (method && !product.decorations.some((d) => d.id === method)) return false;

      if (minOrder) {
        const moq = product.moq;
        if (minOrder === "lt150" && moq >= 150) return false;
        if (minOrder === "150-250" && (moq < 150 || moq > 250)) return false;
        if (minOrder === "gt250" && moq <= 250) return false;
      }

      if (priceRange) {
        const from = product.priceTiers[product.priceTiers.length - 1].perUnitUsd;
        if (priceRange === "lt25" && from >= 25) return false;
        if (priceRange === "25-75" && (from < 25 || from > 75)) return false;
        if (priceRange === "gt75" && from <= 75) return false;
      }

      if (q) {
        const haystack = `${product.displayName} ${product.skuCode} ${product.headline} ${product.category}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [products, category, method, minOrder, priceRange, query]);

  const anyActive = Boolean(category || method || minOrder || priceRange || query);

  function clearAll() {
    setCategory(null);
    setMethod("");
    setMinOrder("");
    setPriceRange("");
    setQuery("");
  }

  return (
    <>
      <section className="filter-bar" aria-label="Catalog filters">
        <div className="filter-bar-head">
          <p className="eyebrow">Filter catalog</p>
          {anyActive ? (
            <button type="button" className="clear-filters" onClick={clearAll}>
              <span aria-hidden>✕</span> Clear filters
            </button>
          ) : null}
        </div>

        <div className="filter-bar-row">
          <div className="filter-group">
            <span className="filter-label">Production method</span>
            <BrandSelect value={method} onChange={setMethod} options={methodOptions} ariaLabel="Production method" />
          </div>

          <div className="filter-icons" role="group" aria-label="Category quick filters">
            {categories.map(([cat]) => {
              const selected = category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  className={`filter-icon-btn${selected ? " filter-icon-btn--active" : ""}`}
                  aria-pressed={selected}
                  onClick={() => setCategory(selected ? null : cat)}
                >
                  <CatIcon type={cat} />
                  <span>{CATEGORY_LABELS[cat] ?? cat}</span>
                </button>
              );
            })}
          </div>

          <div className="filter-group">
            <span className="filter-label">Minimum order</span>
            <BrandSelect value={minOrder} onChange={setMinOrder} options={MIN_ORDER_OPTIONS} ariaLabel="Minimum order" />
          </div>

          <div className="filter-group">
            <span className="filter-label">Price range</span>
            <BrandSelect value={priceRange} onChange={setPriceRange} options={PRICE_OPTIONS} ariaLabel="Price range" />
          </div>

          <div className="filter-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 5h16l-6 7v6l-4 2v-8z" />
            </svg>
            <input
              type="search"
              placeholder="Search by name"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search by name"
            />
          </div>
        </div>
      </section>

      <section id="catalog">
        <div className="section-head">
          <div>
            <p className="eyebrow">Catalog</p>
            <h2>{category ? CATEGORY_LABELS[category] ?? category : "The Collection"}</h2>
          </div>
          <span className="label">{filtered.length} {filtered.length === 1 ? "style" : "styles"}</span>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            No products match these filters.{" "}
            <button type="button" className="link-button" onClick={clearAll}>Clear filters</button>
          </div>
        ) : (
          <div className="catalog-grid">
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
