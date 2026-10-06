import { beforeEach, expect, it, vi } from "vitest";
import type { ShopOrder } from "@/lib/types";

const state = vi.hoisted(() => ({ order: {} as Record<string, unknown>, writes: 0, conflict: false }));
vi.mock("@/lib/supabase", () => ({
  orderLookupColumn: () => "id",
  getSupabase: () => ({ from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { data: structuredClone(state.order) }, error: null }) }) }),
    update: (patch: { data: Record<string, unknown> }) => ({ eq: () => ({ eq: async () => {
      state.writes++;
      if (!state.conflict) {
        state.order = structuredClone(patch.data);
        const snapshot = state.order.taxCalculation as Record<string, unknown>;
        state.order.taxCalculation = Object.fromEntries(Object.entries(snapshot).reverse());
      }
      return { error: null };
    } }) }),
  }) }),
}));
import { setOrderTax } from "@/lib/store";

beforeEach(() => {
  state.order = { id: "order", stripeSessionId: "cs_test", totalUsd: 10, taxUsd: 0 };
  state.writes = 0; state.conflict = false;
});
it("accepts JSONB key reordering after saving and on payment replay", async () => {
  await setOrderTax(state.order as unknown as ShopOrder, "cs_test", 1000, 86);
  await setOrderTax(state.order as unknown as ShopOrder, "cs_test", 1000, 86);
  expect(state.writes).toBe(1);
  expect(state.order.totalUsd).toBe(10.86);
});
it("still rejects changed financial values after persistence", async () => {
  await setOrderTax(state.order as unknown as ShopOrder, "cs_test", 1000, 86);
  await expect(setOrderTax(state.order as unknown as ShopOrder, "cs_test", 1000, 87)).rejects.toThrow("Paid tax snapshot changed");
});
it("requires retry when another write wins the compare-and-swap", async () => {
  state.conflict = true;
  await expect(setOrderTax(state.order as unknown as ShopOrder, "cs_test", 1000, 86)).rejects.toThrow("Checkout changed");
});
