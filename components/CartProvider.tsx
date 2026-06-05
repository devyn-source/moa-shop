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
};

type CartContextValue = {
  items: CartItem[];
  hydrated: boolean;
  count: number;
  total: number;
  addItem: (item: Omit<CartItem, "lineId">) => void;
  removeItem: (lineId: string) => void;
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

  const removeItem = useCallback((lineId: string) => {
    setItems((prev) => prev.filter((item) => item.lineId !== lineId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const count = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);
  const total = useMemo(() => items.reduce((sum, item) => sum + item.totalUsd, 0), [items]);

  const value = useMemo(
    () => ({ items, hydrated, count, total, addItem, removeItem, clear }),
    [items, hydrated, count, total, addItem, removeItem, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
