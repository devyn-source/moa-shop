import "server-only";
// Server-side Supabase client bound to the request cookies, for reading the
// signed-in customer in Server Components / Route Handlers. Anon key + the
// user's session cookie — NOT the service role (that stays in lib/supabase.ts).
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // In Server Components cookie writes throw; the middleware refresh
          // (proxy.ts) handles persistence, so swallow the error here.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            /* no-op in RSC */
          }
        }
      }
    }
  );
}

// Convenience: the current signed-in user (or null).
export async function getCurrentUser() {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  return user;
}
