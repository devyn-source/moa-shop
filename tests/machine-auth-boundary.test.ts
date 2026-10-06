import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest, type NextFetchEvent } from "next/server";
const mocks = vi.hoisted(() => ({ customer: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ clerkMiddleware: () => mocks.customer, createRouteMatcher: () => () => false }));
vi.mock("@/lib/admin-auth", () => ({ basicAuthValid: () => false, emailIsAdmin: () => false, clerkEmail: () => null }));
import proxy from "@/proxy";
beforeEach(() => { vi.clearAllMocks(); mocks.customer.mockReturnValue(new Response(null, { status: 401 })); });
it.each(["/api/webhooks/stripe", "/api/cron/express-refunds", "/api/cron/express-operations", "/api/cron/fulfillment"])("leaves %s authentication to its signature/secret handler", async path => {
  expect((await proxy(new NextRequest(`https://shop.example${path}`), {} as NextFetchEvent))?.status).toBe(200);
  expect(mocks.customer).not.toHaveBeenCalled();
});
it.each(["/api/checkout", "/orders", "/admin/operations", "/api/webhooks/stripe/extra"])("preserves customer authentication for %s", path => {
  proxy(new NextRequest(`https://shop.example${path}`), {} as NextFetchEvent);
  expect(mocks.customer).toHaveBeenCalledTimes(1);
});
