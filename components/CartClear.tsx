"use client";

import { useEffect } from "react";
import { useCart } from "./CartProvider";

// Drops the cart once after the success page mounts — payment succeeded.
export function CartClear() {
  const { clear } = useCart();
  useEffect(() => {
    clear();
  }, [clear]);
  return null;
}
