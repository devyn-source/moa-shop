"use client";

// Customer account control in the header. Clerk-backed: avatar menu + "My Orders"
// when signed in, "Sign in" otherwise. Pricing/browsing stay public; the account
// is required only to order.
import Link from "next/link";
import { useUser, UserButton } from "@clerk/nextjs";

export function AccountNav() {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return null;

  if (isSignedIn) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 14 }}>
        <Link href="/orders" className="nav-link">My Orders</Link>
        <UserButton />
      </span>
    );
  }

  return (
    <Link href="/sign-in" className="nav-link nav-link--muted">Sign in</Link>
  );
}
