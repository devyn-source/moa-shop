import { z } from "zod";

// Request-body schemas for the untrusted public endpoints. Zod strips unknown
// keys by default, so handlers only see validated, known fields.

// /api/config/share — save a sharable configurator state.
export const configShareSchema = z.object({
  slug: z.string().min(1).max(128),
  config: z.unknown()
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
