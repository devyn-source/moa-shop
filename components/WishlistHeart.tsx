"use client";

// Wishlist heart — a tiny client island so ProductCard stays server-rendered.
// All hearts on a page share ONE module-level store (one GET /api/wishlist per
// page load, not per card). Signed-out clicks route to /sign-in; signed-in
// clicks toggle optimistically and reconcile with the server response.
import { useEffect, useSyncExternalStore } from "react";

type WishlistState = {
  slugs: ReadonlySet<string>;
  signedIn: boolean | null; // null = not yet known
};

let state: WishlistState = { slugs: new Set(), signedIn: null };
let loadPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function setState(next: WishlistState) {
  state = next;
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function load(): Promise<void> {
  if (!loadPromise) {
    loadPromise = fetch("/api/wishlist")
      .then(async (res) => {
        if (res.status === 401) {
          setState({ ...state, signedIn: false });
          return;
        }
        if (!res.ok) return; // leave state unknown; toggle still works
        const data = (await res.json()) as { slugs?: string[] };
        setState({ slugs: new Set(data.slugs ?? []), signedIn: true });
      })
      .catch(() => {
        /* offline / transient — hearts just start empty */
      });
  }
  return loadPromise;
}

async function toggle(slug: string): Promise<void> {
  if (state.signedIn === false) {
    window.location.href = "/sign-in";
    return;
  }
  // Optimistic flip.
  const wasSaved = state.slugs.has(slug);
  const next = new Set(state.slugs);
  if (wasSaved) next.delete(slug);
  else next.add(slug);
  setState({ ...state, slugs: next });

  try {
    const res = await fetch("/api/wishlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug })
    });
    if (res.status === 401) {
      setState({ slugs: new Set(), signedIn: false });
      window.location.href = "/sign-in";
      return;
    }
    if (!res.ok) throw new Error("toggle failed");
    // Reconcile with the server's answer (covers double-taps racing).
    const data = (await res.json()) as { saved?: boolean };
    const settled = new Set(state.slugs);
    if (data.saved) settled.add(slug);
    else settled.delete(slug);
    setState({ ...state, slugs: settled, signedIn: true });
  } catch {
    // Revert the optimistic flip.
    const reverted = new Set(state.slugs);
    if (wasSaved) reverted.add(slug);
    else reverted.delete(slug);
    setState({ ...state, slugs: reverted });
  }
}

export function WishlistHeart({ slug, productName }: { slug: string; productName: string }) {
  const saved = useSyncExternalStore(
    subscribe,
    () => state.slugs.has(slug),
    () => false
  );

  useEffect(() => {
    void load();
  }, []);

  return (
    <button
      type="button"
      className={`wish-heart${saved ? " is-saved" : ""}`}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${productName} from wishlist` : `Save ${productName} to wishlist`}
      title={saved ? "Saved — tap to remove" : "Save for later"}
      onClick={(e) => {
        // The card itself is a Link to the PDP — the heart must not navigate.
        e.preventDefault();
        e.stopPropagation();
        void toggle(slug);
      }}
    >
      <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false">
        <path
          d="M12 20.2C7.6 17 3.4 13.6 3.4 9.7c0-2.6 2-4.7 4.5-4.7 1.6 0 3.1.8 4.1 2.2 1-1.4 2.5-2.2 4.1-2.2 2.5 0 4.5 2.1 4.5 4.7 0 3.9-4.2 7.3-8.6 10.5z"
          fill={saved ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
