"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useCart } from "./CartProvider";
import { groupCartItems } from "@/lib/bundle";
import { currency } from "@/lib/pricing";

const EASE = [0.22, 1, 0.36, 1] as const;

export function CartButton() {
  const { items, count, total, hydrated } = useCart();
  const { bundles, singles } = useMemo(() => groupCartItems(items), [items]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(true);
  };
  // small delay so moving cursor from button → panel doesn't flicker it shut
  const hideSoon = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 220);
  };

  return (
    <div className="cart-wrap" onMouseEnter={show} onMouseLeave={hideSoon} onFocus={show} onBlur={hideSoon}>
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
              transition={{ duration: 0.34, ease: EASE }}
            >
              {count > 999 ? "999+" : count}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </Link>

      {/* Desktop hover preview (CSS hides it on touch — tap goes straight to /cart) */}
      <AnimatePresence>
        {open && hydrated ? (
          <motion.div
            className="cart-pop"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.22, ease: EASE }}
          >
            <div className="cart-pop-inner">
            {items.length === 0 ? (
              <div className="cart-pop-empty">
                <span>Your cart is empty.</span>
                <Link href="/p/pr-box" className="link-button">Build a PR Box →</Link>
              </div>
            ) : (
              <>
                <div className="cart-pop-head">
                  <span>Your cart</span>
                  <span>{count.toLocaleString()} units</span>
                </div>
                <div className="cart-pop-lines">
                  {bundles.map((b) => (
                    <div className="cart-pop-line" key={b.bundleId}>
                      <span className="cart-pop-thumb cart-pop-thumb--box" aria-hidden>◧</span>
                      <span className="cart-pop-name"><b>{b.label}</b> · {b.boxQty.toLocaleString()} boxes</span>
                      <span className="cart-pop-price">{currency(b.boxTotalUsd)}</span>
                    </div>
                  ))}
                  {singles.map((it) => (
                    <div className="cart-pop-line" key={it.lineId}>
                      <span className="cart-pop-thumb">
                        {it.image ? <img src={it.image} alt="" loading="lazy" /> : null}
                      </span>
                      <span className="cart-pop-name">{it.displayName} · {it.quantity.toLocaleString()} units</span>
                      <span className="cart-pop-price">{currency(it.totalUsd)}</span>
                    </div>
                  ))}
                </div>
                <div className="cart-pop-total">
                  <span>Total</span>
                  <strong>{currency(total)}</strong>
                </div>
                <div className="cart-pop-actions">
                  <Link href="/cart" className="button button--full">View cart →</Link>
                  <Link href="/checkout" className="cart-pop-checkout">Checkout</Link>
                </div>
              </>
            )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
