import { CheckoutClient } from "./CheckoutClient";
import { expressCheckoutEnabled } from "@/lib/express-bridge";

export const dynamic = "force-dynamic";

export default function CheckoutPage() {
  return <CheckoutClient express={expressCheckoutEnabled()} />;
}
