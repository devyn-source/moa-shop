import { SignIn } from "@clerk/nextjs";
import { moaClerkAppearance } from "@/lib/clerk-appearance";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sign in · MOA Catalog" };

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
          <span className="signin-wordmark">MOA</span>
          <span className="signin-rule" aria-hidden />
          <p className="signin-eyebrow">MOA Catalog · Your account</p>
          <h1 className="signin-headline">Sign in to continue</h1>
          <p className="signin-sub">Track orders, approve proofs, and pick up saved designs.</p>
        </div>
        <SignIn appearance={moaClerkAppearance} signUpUrl="/sign-up" fallbackRedirectUrl="/orders" />
      </div>
    </main>
  );
}
