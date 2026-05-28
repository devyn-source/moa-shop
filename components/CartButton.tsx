"use client";

import Link from "next/link";
import { useCart } from "./CartProvider";

export function CartButton() {
  const { count, hydrated } = useCart();
  return (
    <Link href="/cart" className="cart-button" aria-label={`Cart, ${count} items`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 5h2l1.5 11h10L20 8H7" />
        <circle cx="9.5" cy="20" r="1" />
        <circle cx="17.5" cy="20" r="1" />
      </svg>
      <span>Cart</span>
      {hydrated && count > 0 ? <span className="cart-badge">{count > 999 ? "999+" : count}</span> : null}
    </Link>
  );
}
