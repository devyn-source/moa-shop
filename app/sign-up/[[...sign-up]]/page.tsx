import { SignUp } from "@clerk/nextjs";
import { AuthShell, AuthUnavailable } from "@/components/AuthShell";
import { moaAuthAppearance } from "@/lib/clerk-appearance";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create your account | MOA Catalog", robots: { index: false, follow: false } };

export default function SignUpPage() {
  return <AuthShell mode="sign-up">
    {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
      ? <SignUp appearance={moaAuthAppearance} routing="path" path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/welcome" />
      : <AuthUnavailable />}
  </AuthShell>;
}
