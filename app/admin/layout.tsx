// Admin is auth-gated (proxy.ts Basic Auth) and reads live Supabase data, so it
// must never be statically prerendered — that couples the BUILD to runtime env
// (SUPABASE_URL / SERVICE_ROLE_KEY) and breaks env-light deployments such as
// branch previews. Force the whole /admin segment to render dynamically.
export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
