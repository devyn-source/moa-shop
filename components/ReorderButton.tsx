"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart, type CartItem } from "./CartProvider";
import { analytics } from "@/lib/analytics";

// "Order this again" — drops a past order's exact configuration back into the cart.
export function ReorderButton({ item }: { item: Omit<CartItem, "lineId"> }) {
  const { addItem } = useCart();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        analytics.track("reorder", { slug: item.slug, value: item.totalUsd });
        addItem(item);
        router.push("/cart");
      }}
    >
      {busy ? "Adding…" : "Reorder →"}
    </button>
  );
}
