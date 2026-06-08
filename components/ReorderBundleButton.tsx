"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart, type CartItem } from "./CartProvider";
import { analytics } from "@/lib/analytics";

// Reorder a whole PR Box — re-add every line atomically under a fresh bundleId so
// the cart treats it as a new box (and re-validates the bundle discount at checkout).
export function ReorderBundleButton({ lines, label, compact }: { lines: Omit<CartItem, "lineId">[]; label?: string; compact?: boolean }) {
  const { addBundle } = useCart();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={compact ? "reorder-mini" : "button"}
      disabled={busy || !lines.length}
      onClick={(e) => {
        // these sit inside clickable cards — don't trigger the card
        e.preventDefault();
        e.stopPropagation();
        setBusy(true);
        const bundleId = crypto.randomUUID();
        analytics.track("reorder_box", { lines: lines.length });
        addBundle(lines.map((l) => ({ ...l, bundleId })));
        router.push("/cart");
      }}
    >
      {busy ? "Adding…" : label ?? (compact ? "Reorder box ↻" : "Reorder box →")}
    </button>
  );
}
