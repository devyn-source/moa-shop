import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ currentUser: mocks.user, auth: vi.fn(), clerkClient: async () => ({ users: { getUser: mocks.user } }) }));
import { currentCustomerEmail } from "@/lib/order-access";
import { clerkEmail } from "@/lib/admin-auth";
beforeEach(() => vi.clearAllMocks());
it("does not authorize an unverified primary email for customer or staff access", async () => {
  mocks.user.mockResolvedValue({primaryEmailAddress:{emailAddress:"devyn@magnumopus.agency",verification:{status:"unverified"}}});
  expect(await currentCustomerEmail()).toBeNull(); expect(await clerkEmail("user-test")).toBeNull();
});
it("requires explicit verification rather than trusting an arbitrary alternate email", async () => {
  mocks.user.mockResolvedValue({emailAddresses:[{emailAddress:"devyn@magnumopus.agency"}]});
  expect(await currentCustomerEmail()).toBeNull(); expect(await clerkEmail("user-test")).toBeNull();
});
it("normalizes verified identities for existing order continuity", async () => {
  mocks.user.mockResolvedValue({primaryEmailAddress:{emailAddress:"Devyn@MagnumOpus.Agency",verification:{status:"verified"}}});
  expect(await currentCustomerEmail()).toBe("devyn@magnumopus.agency"); expect(await clerkEmail("user-test")).toBe("devyn@magnumopus.agency");
});
