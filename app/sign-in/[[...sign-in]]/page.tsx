import { SignIn } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

// MOA brand appearance for Clerk — terracotta primary, Archivo, warm linen card.
const moaAppearance = {
  variables: {
    colorPrimary: "#B04731",
    colorText: "#1E1E1E",
    colorTextSecondary: "#8A8680",
    colorBackground: "#FFFFFF",
    colorInputBackground: "#FFFFFF",
    colorInputText: "#1E1E1E",
    colorDanger: "#B04731",
    borderRadius: "0.6rem",
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: "0.95rem",
  },
  elements: {
    rootBox: "moa-clerk-root",
    card: "moa-clerk-card",
    headerTitle: "moa-clerk-title",
    headerSubtitle: "moa-clerk-subtitle",
    socialButtonsBlockButton: "moa-clerk-social",
    formButtonPrimary: "moa-clerk-primary",
    formFieldInput: "moa-clerk-input",
    footerActionLink: "moa-clerk-link",
  },
} as const;

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
          <p className="signin-eyebrow">MOA Catalog · Operator Console</p>
          <h1 className="signin-headline">Sign in to continue</h1>
          <p className="signin-sub">Back-office access for the standardized MOA Catalog.</p>
        </div>
        <SignIn appearance={moaAppearance} signUpUrl="/sign-up" fallbackRedirectUrl="/admin" />
      </div>
    </main>
  );
}
