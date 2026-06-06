"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type CartItem = {
  lineId: string;
  productId: string;
  slug: string;
  displayName: string;
  skuCode: string;
  variantId: string;
  colorLabel: string;
  colorHex?: string;
  image?: string;
  decorationIds: string[];
  decorationLabel: string;
  sizeQty: Record<string, number>;
  quantity: number;
  perUnitUsd: number;
  decorationAdderUsd: number;
  subtotalUsd: number;
  totalUsd: number;
  artworkFileName: string;
  artworkFileUrl?: string;
  artworkNotes: string;
  artworkPlacement?: import("@/lib/types").ArtworkPlacement;
  artworkPlacements?: import("@/lib/types").ArtworkPlacement[];
  wovenLabel?: boolean;
  // --- PR Box (bundle) --- set on lines that belong to a box; absent on singles.
  bundleId?: string;
  bundleLabel?: string;
  bundleRole?: "component" | "packaging";
  perBoxQty?: number; // units of this line per box
  perBoxUsd?: number; // this line's gross contribution to one box
  bundleDiscountUsd?: number; // this line's share of the box discount (already in totalUsd)
  promoId?: string;
};

type CartContextValue = {
  items: CartItem[];
  hydrated: boolean;
  count: number;
  total: number;
  addItem: (item: Omit<CartItem, "lineId">) => void;
  addBundle: (lines: Omit<CartItem, "lineId">[]) => void;
  removeItem: (lineId: string) => void;
  removeBundle: (bundleId: string) => void;
  clear: () => void;
};

const STORAGE_KEY = "moa-cart-v1";
const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw) as CartItem[]);
    } catch {
      // ignore corrupt cart
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const addItem = useCallback((item: Omit<CartItem, "lineId">) => {
    setItems((prev) => [...prev, { ...item, lineId: crypto.randomUUID() }]);
  }, []);

  // Add a whole PR Box atomically — all lines share the bundleId set by the caller.
  const addBundle = useCallback((lines: Omit<CartItem, "lineId">[]) => {
    setItems((prev) => [...prev, ...lines.map((line) => ({ ...line, lineId: crypto.randomUUID() }))]);
  }, []);

  const removeItem = useCallback((lineId: string) => {
    setItems((prev) => prev.filter((item) => item.lineId !== lineId));
  }, []);

  const removeBundle = useCallback((bundleId: string) => {
    setItems((prev) => prev.filter((item) => item.bundleId !== bundleId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const count = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);
  const total = useMemo(() => items.reduce((sum, item) => sum + item.totalUsd, 0), [items]);

  const value = useMemo(
    () => ({ items, hydrated, count, total, addItem, addBundle, removeItem, removeBundle, clear }),
    [items, hydrated, count, total, addItem, addBundle, removeItem, removeBundle, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
