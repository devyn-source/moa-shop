import { describe, expect, it } from "vitest";
import { checkoutContactSchema } from "@/lib/checkout-contact";

const contact = {
  contactName: " Alex Test ", contactEmail: " ALEX@example.com ",
  shipToAddress: { line1: " 100 Main Street ", city: "Los Angeles", state: "CA", postalCode: "90012", country: "United States" },
};

describe("checkout contact", () => {
  it("normalizes autofill and supplies optional recipient/company from the contact", () => {
    const parsed = checkoutContactSchema.parse(contact);
    expect(parsed.contactEmail).toBe("alex@example.com");
    expect(parsed.companyName).toBe("Alex Test");
    expect(parsed.shipToName).toBe("Alex Test");
    expect(parsed.shipToAddress.line1).toBe("100 Main Street");
  });
  it("rejects incomplete US shipping before creating an order", () => {
    expect(checkoutContactSchema.safeParse({ ...contact, shipToAddress: { ...contact.shipToAddress, state: "" } }).success).toBe(false);
    expect(checkoutContactSchema.safeParse({ ...contact, shipToAddress: { ...contact.shipToAddress, postalCode: "hello" } }).success).toBe(false);
  });
  it("accepts international postal codes and a different recipient", () => {
    const parsed = checkoutContactSchema.parse({ ...contact, shipToName: "Receiving team", shipToAddress: { ...contact.shipToAddress, country: "United Kingdom", state: "", postalCode: "SW1A 1AA" } });
    expect(parsed.shipToName).toBe("Receiving team");
    expect(parsed.shipToAddress.postalCode).toBe("SW1A 1AA");
  });
  it("requires a specific country instead of the Other placeholder", () => {
    expect(checkoutContactSchema.safeParse({ ...contact, shipToAddress: { ...contact.shipToAddress, country: "Other" } }).success).toBe(false);
  });
});
