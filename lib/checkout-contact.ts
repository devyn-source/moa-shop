import { z } from "zod";

const required = (label: string, max: number) => z.string().trim().min(1, `${label} is required.`).max(max);
const optional = (max: number) => z.string().trim().max(max).default("");

export const checkoutContactSchema = z.object({
  contactName: required("Full name", 120).min(2, "Enter your full name."),
  contactEmail: z.string().trim().toLowerCase().email("Enter a valid email address.").max(200),
  contactPhone: optional(40),
  companyName: optional(160),
  shipToName: optional(160),
  shipToAddress: z.object({
    line1: required("Street address", 200), line2: optional(200),
    city: required("City", 120), state: optional(80),
    postalCode: required("Postal code", 20), country: required("Country", 80),
  }).superRefine((address, ctx) => {
    if (address.country === "Other") ctx.addIssue({ code: "custom", path: ["country"], message: "Enter your country name." });
    if (["United States", "US", "USA"].includes(address.country)) {
      if (!address.state) ctx.addIssue({ code: "custom", path: ["state"], message: "Select your state." });
      if (!/^\d{5}(-\d{4})?$/.test(address.postalCode)) ctx.addIssue({ code: "custom", path: ["postalCode"], message: "Enter a valid ZIP code." });
    }
  }),
}).transform((contact) => ({
  ...contact,
  companyName: contact.companyName || contact.contactName,
  shipToName: contact.shipToName || contact.contactName,
}));
