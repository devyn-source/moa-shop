import { z } from "zod";

const url = z.string().url().refine((value) => value.startsWith("https://"));
const placement = z.object({
  id: z.string().max(80), artUrl: url, fileUrl: url.optional(), fileName: z.string().max(255).optional(),
  piece: z.number().int().min(1).max(2),
  widthIn: z.number().finite().min(0.25).max(30), belowHpsIn: z.number().finite().min(0).max(50), fromCfIn: z.number().finite().min(-30).max(30),
  pixelWidth: z.number().positive().optional(), pixelHeight: z.number().positive().optional(), isVector: z.boolean().optional(),
});
export const designDraftSchema = z.object({
  version: z.literal(1), slug: z.string(), savedAt: z.number(), variantId: z.string(),
  decorationIds: z.array(z.string()).max(1), sizeQty: z.record(z.string(), z.number().int().min(0).max(100000)),
  placements: z.array(placement).max(2),
  wovenLabel: z.object({
    text: z.string().max(200), fold: z.literal("flat"), placement: z.literal("neck"), labelColor: z.string(), thread: z.string(),
    logoUrl: url.optional(), logoFileUrl: url.optional(), logoName: z.string().optional(),
    logoTransform: z.object({ ox: z.number(), oy: z.number(), sx: z.number(), sy: z.number(), r: z.number().optional() }).optional(),
  }).nullable().optional(),
  fabricOptionId: z.string().optional(),
});
export type DesignDraft = z.infer<typeof designDraftSchema>;
export const draftKey = (slug: string) => `moa:design:v1:${slug}`;
export function readDesignDraft(raw: unknown, slug: string, now = Date.now()): DesignDraft | null {
  const parsed = designDraftSchema.safeParse(raw);
  if (!parsed.success || parsed.data.slug !== slug || now - parsed.data.savedAt > 7 * 86400000) return null;
  if (new Set(parsed.data.placements.map((p) => p.piece)).size !== parsed.data.placements.length) return null;
  return parsed.data;
}
