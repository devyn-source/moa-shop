import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Welcome | MOA Catalog", robots: { index: false, follow: false } };

export default async function WelcomePage() {
  const user = await currentUser();
  if (!user) redirect("/sign-up");
  return <AuthShell mode="welcome">
    <div className="account-welcome">
      <span className="account-success" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m5 12 4 4L19 6" /></svg></span>
      <h2>You’re all set.</h2>
      <p>Your MOA account is ready.</p>
      <Link href="/shop" className="account-cta">Explore the catalog <span aria-hidden="true">→</span></Link>
      <Link href="/orders" className="account-secondary">My orders</Link>
    </div>
  </AuthShell>;
}
