import { redirect, notFound } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { getExpressOrder } from "@/lib/express-account";
import { ExpressOrderPortal } from "@/components/ExpressOrderPortal";

export const dynamic = "force-dynamic";

export default async function ExpressOrderPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const user = await currentUser();
  const primary = user?.primaryEmailAddress;
  const email = primary?.verification?.status === "verified" ? primary.emailAddress.toLowerCase() : null;
  if (!email) redirect(`/sign-in?redirect_url=${encodeURIComponent(`/orders/express/${number}`)}`);
  const order = await getExpressOrder(decodeURIComponent(number), email);
  if (!order) notFound();
  return <ExpressOrderPortal order={order} />;
}
