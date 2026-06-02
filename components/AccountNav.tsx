// Customer account control in the header. Server component: shows "My Orders"
// + sign-out when signed in, "Sign in" otherwise. Skips the Supabase round-trip
// entirely for anonymous visitors (no sb- cookie) to keep public pages fast.
import Link from "next/link";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/supabase-server";

export async function AccountNav() {
  const cookieStore = await cookies();
  const hasSession = cookieStore.getAll().some((c) => c.name.startsWith("sb-"));
  const user = hasSession ? await getCurrentUser() : null;

  if (!user) {
    return (
      <Link href="/login" className="nav-link nav-link--muted">Sign in</Link>
    );
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 14 }}>
      <Link href="/orders" className="nav-link">My Orders</Link>
      <form action="/auth/signout" method="post" style={{ display: "inline" }}>
        <button
          type="submit"
          className="nav-link nav-link--muted"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, font: "inherit" }}
        >
          Sign out
        </button>
      </form>
    </span>
  );
}
