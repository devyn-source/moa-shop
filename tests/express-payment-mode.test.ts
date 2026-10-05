import { afterEach, expect, it, vi } from "vitest";
import { activeCheckoutMode, assertRehearsalCustomer, backendSandbox } from "@/lib/express-payment-mode";
afterEach(()=>vi.unstubAllEnvs());
function rehearsal() { vi.stubEnv("EXPRESS_STRIPE_TEST","1"); vi.stubEnv("EXPRESS_SANDBOX","0"); vi.stubEnv("STRIPE_SECRET_KEY","sk_test_fixture"); vi.stubEnv("VERCEL_ENV","preview"); }
it("keeps processor rehearsal separate while forcing sandbox backend behavior",()=>{
 rehearsal();expect(activeCheckoutMode()).toBe("express_stripe_test");expect(backendSandbox()).toBe(true);
});
it("rejects a live key, production deployment, or mixed simulation flag",()=>{
 rehearsal();vi.stubEnv("STRIPE_SECRET_KEY","sk_live_fixture");expect(activeCheckoutMode).toThrow();
 rehearsal();vi.stubEnv("VERCEL_ENV","production");expect(activeCheckoutMode).toThrow();
 rehearsal();vi.stubEnv("EXPRESS_SANDBOX","1");expect(activeCheckoutMode).toThrow();
});
it("limits preview checkout to assigned rehearsal accounts",()=>{
 rehearsal();expect(()=>assertRehearsalCustomer("other@example.com")).toThrow();expect(()=>assertRehearsalCustomer("devyn@magnumopus.agency")).not.toThrow();
});
