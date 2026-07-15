import { NextResponse } from "next/server";
import { listWishlistSlugs, toggleWishlist } from "@/lib/wishlist";
import { currentCustomerEmail } from "@/lib/order-access";
import { getProductBySlug } from "@/lib/store";
import { wishlistToggleSchema } from "@/lib/validation";
import { apiError } from "@/lib/errors";

// Wishlist hearts. Clerk-authed (same session read as /api/orders): the
// wishlist belongs to the signed-in email — signed-out requests get a 401 and
// the UI routes them to /sign-in.
export const runtime = "nodejs";

// GET — the signed-in customer's saved product slugs, newest first.
export async function GET() {
  try {
    const email = await currentCustomerEmail();
    if (!email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    return NextResponse.json({ slugs: await listWishlistSlugs(email) });
  } catch (e) {
    return apiError(e, { fallback: "Couldn't load your wishlist.", status: 500 });
  }
}

// POST { slug } — toggle a heart. Responds with the new state.
export async function POST(req: Request) {
  try {
    const email = await currentCustomerEmail();
    if (!email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const { slug } = wishlistToggleSchema.parse(await req.json());
    // Only real catalog products can be hearted — keeps the table clean.
    if (!(await getProductBySlug(slug))) {
      return NextResponse.json({ error: "Unknown product." }, { status: 404 });
    }
    const saved = await toggleWishlist(email, slug);
    return NextResponse.json({ saved });
  } catch (e) {
    return apiError(e, { fallback: "Couldn't update your wishlist.", status: 500 });
  }
}
