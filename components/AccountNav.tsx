"use client";

// Customer account control in the header. Clerk-backed: avatar menu + "My Orders"
// when signed in, "Sign in" otherwise. Pricing/browsing stay public; the account
// is required only to order.
//
// Clerk is mounted only when configured (see app/layout.tsx MaybeClerk). On envs
// without a Clerk key (e.g. preview deployments) there is no <ClerkProvider>, so
// we must NOT call useUser() — it would throw and break prerendering. The guard
// keeps the hook isolated in a child that only mounts when Clerk is present.
import Link from "next/link";
import { useUser, UserButton } from "@clerk/nextjs";

const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export function AccountNav() {
  if (!clerkConfigured) return null; // no auth context on this env — browsing stays public
  return <AccountNavInner />;
}

function AccountNavInner() {
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
