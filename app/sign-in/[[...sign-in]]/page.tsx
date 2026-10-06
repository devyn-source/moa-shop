import { SignIn } from "@clerk/nextjs";
import { AuthShell, AuthUnavailable } from "@/components/AuthShell";
import { moaAuthAppearance } from "@/lib/clerk-appearance";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in | MOA Catalog", robots: { index: false, follow: false } };

export default function SignInPage() {
  return <AuthShell mode="sign-in">
    {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
      ? <SignIn appearance={moaAuthAppearance} routing="path" path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl="/orders" />
      : <AuthUnavailable />}
  </AuthShell>;
}
