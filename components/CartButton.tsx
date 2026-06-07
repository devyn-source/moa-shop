"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
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
      <AnimatePresence>
        {hydrated && count > 0 ? (
          <motion.span
            key={count}
            className="cart-badge"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: [0.5, 1.22, 1], opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
          >
            {count > 999 ? "999+" : count}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </Link>
  );
}
