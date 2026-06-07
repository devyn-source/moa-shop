"use client";

// Lightweight toast system. Lives in the root layout (outside the page template)
// so a toast survives a route change — e.g. fire on "add to order" and it stays
// up as the page settles. useToast() is a no-op if no provider is mounted.
import { createContext, useCallback, useContext, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";

type Toast = { id: number; message: string; href?: string; cta?: string };
type ToastCtx = { toast: (message: string, opts?: { href?: string; cta?: string }) => void };

const Ctx = createContext<ToastCtx | null>(null);
let seq = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback<ToastCtx["toast"]>((message, opts) => {
    const id = ++seq;
    setToasts((prev) => [...prev.slice(-2), { id, message, href: opts?.href, cta: opts?.cta }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3400);
  }, []);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="toast-stack" aria-live="polite" role="status">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              className="toast"
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="toast-check" aria-hidden>✓</span>
              <span className="toast-msg">{t.message}</span>
              {t.href ? (
                <Link href={t.href} className="toast-cta">{t.cta ?? "View"}</Link>
              ) : null}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  return useContext(Ctx) ?? { toast: () => {} };
}
