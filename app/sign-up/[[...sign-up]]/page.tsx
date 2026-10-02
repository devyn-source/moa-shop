import { SignUp } from "@clerk/nextjs";
import { moaClerkAppearance } from "@/lib/clerk-appearance";

export const dynamic = "force-dynamic";

export const metadata = { title: "Create your account | MOA Shop" };

export default function SignUpPage() {
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
          <h1 className="hx-h2">Create your account</h1>
          <p className="hx-body">One account for your whole program: save designs, approve proofs and track every order to your door.</p>
        </div>
        <SignUp appearance={moaClerkAppearance} signInUrl="/sign-in" fallbackRedirectUrl="/orders" />
      </div>
    </main>
  );
}
