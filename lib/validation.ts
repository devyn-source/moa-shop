import { z } from "zod";

// Request-body schemas for the untrusted public endpoints. Zod strips unknown
// keys by default, so handlers only see validated, known fields.

// /api/config/share — save a sharable configurator state.
export const configShareSchema = z.object({
  slug: z.string().min(1).max(128),
  config: z.unknown()
});

// /api/admin/catalog — product create (Basic-Auth gated; schemas are defense-in-depth).
export const adminProductCreateSchema = z.object({
  displayName: z.string().min(1).max(200),
  headline: z.string().max(300).optional(),
  moq: z.number().int().positive().max(1_000_000).optional()
});

// /api/admin/catalog/[id] — product update. Mirrors ProductUpdateInput (lib/types.ts).
export const adminProductUpdateSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  headline: z.string().max(300).optional(),
  description: z.string().max(5000).optional(),
  bestFor: z.string().max(500).optional(),
  moq: z.number().int().positive().max(1_000_000).optional(),
  leadTimeDays: z.number().int().positive().max(365).optional(),
  vendorUnitCostUsd: z.number().nonnegative().max(100_000).optional(),
  isPublished: z.boolean().optional()
});

// /api/admin/specs/[slug] — Garment Passport save/lock. The spec's deep shape is
// owned by lib/garment-spec.ts; here we guarantee it's a bounded object, not a scalar.
export const adminSpecSaveSchema = z.object({
  spec: z.record(z.string(), z.unknown()),
  approve: z.boolean().optional()
});

// /api/zones/[slug] PUT — placement zones / calibration / measurements. Deep shapes
// are owned by lib/zones.ts; reject scalars so store writes are always structured.
const jsonContainer = z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())]);
export const zonesSaveSchema = z.object({
  zones: jsonContainer.optional(),
  calibration: jsonContainer.optional(),
  measurements: jsonContainer.optional()
});

// /api/samples — sample-kit request (public form; rate-limited + bounded).
export const sampleRequestSchema = z.object({
  contactName: z.string().min(1).max(120),
  contactEmail: z.string().email().max(254),
  companyName: z.string().min(1).max(160),
  roleTitle: z.string().max(120).optional(),
  shipTo: z.object({
    line1: z.string().min(1).max(200),
    line2: z.string().max(200).optional(),
    city: z.string().min(1).max(120),
    state: z.string().max(120).optional(),
    postalCode: z.string().min(1).max(20),
    country: z.string().min(1).max(120)
  }),
  interestedSlugs: z.array(z.string().max(64)).max(20).default([]),
  estQuantity: z.string().max(60).optional(),
  timeline: z.string().max(60).optional(),
  notes: z.string().max(2000).optional()
});

// /api/orders/[id]/update — self-serve edit patch. Only these fields may change.
export const orderUpdateSchema = z.object({
  variantId: z.string().min(1).optional(),
  decorationIds: z.array(z.string().max(64)).max(20).optional(),
  artworkFileUrl: z.string().url().max(2048).optional(),
  artworkFileName: z.string().max(256).optional(),
  sizeBreakdown: z.record(z.string().max(16), z.number().int().nonnegative().max(1_000_000)).optional(),
  artworkPlacement: z.unknown().optional(),
  artworkPlacements: z.array(z.unknown()).max(20).optional()
});
