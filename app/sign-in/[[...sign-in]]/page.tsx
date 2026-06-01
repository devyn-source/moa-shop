import { SignIn } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <main className="page">
        <div className="empty-state">
          Auth not yet configured. Add <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and{" "}
          <code>CLERK_SECRET_KEY</code> in Vercel env, then redeploy.
        </div>
      </main>
    );
  }
  return (
    <main className="page" style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
      <SignIn appearance={{ variables: { colorPrimary: "#B04731" } }} />
    </main>
  );
}
