import { redirect, notFound } from "next/navigation";
import { sandboxPay } from "@/lib/express-account";

export const dynamic = "force-dynamic";

// Sandbox only: stands in for the Stripe payment page so the full approve,
// pay and launch path can be clicked through without a real charge.
export default async function SandboxPay({ params }: { params: Promise<{ number: string }> }) {
  if (process.env.EXPRESS_SANDBOX !== "1") notFound();
  const { number } = await params;
  await sandboxPay(decodeURIComponent(number));
  redirect(`/orders/express/${number}`);
}
