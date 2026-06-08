import { currentUser } from "@clerk/nextjs/server";

// The signed-in customer's primary email, lowercased — or null. Safe if Clerk
// isn't configured / there's no session (returns null → callers must deny).
export async function currentCustomerEmail(): Promise<string | null> {
  try {
    const user = await currentUser();
    return user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

// Authorization: does the signed-in customer own this order? We use the Supabase
// SERVICE-ROLE key for all DB access (which bypasses RLS), so ownership MUST be
// enforced here in app code — never trust the URL id alone.
export function ownsOrder(order: { contactEmail?: string | null } | null | undefined, email: string | null): boolean {
  return Boolean(order && email && order.contactEmail && order.contactEmail.toLowerCase() === email);
}
