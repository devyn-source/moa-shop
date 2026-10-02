import { SignIn } from "@clerk/nextjs";
import { moaClerkAppearance } from "@/lib/clerk-appearance";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sign in | MOA Shop" };

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
    <main className="signin-stage">
      <div className="signin-frame">
        <div className="signin-brand">
          <h1 className="hx-h2">Sign in</h1>
          <p className="hx-body">Track orders, approve proofs and pick up saved designs.</p>
        </div>
        <SignIn appearance={moaClerkAppearance} signUpUrl="/sign-up" fallbackRedirectUrl="/orders" />
      </div>
    </main>
  );
}
