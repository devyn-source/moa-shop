"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function CheckoutRefresh() {
  const router = useRouter();
  useEffect(() => {
    let attempts = 0;
    const timer = setInterval(() => { if (++attempts > 20) clearInterval(timer); else router.refresh(); }, 3000);
    return () => clearInterval(timer);
  }, [router]);
  return <button className="button button--secondary" onClick={() => router.refresh()}>Refresh order status</button>;
}
