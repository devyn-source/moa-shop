import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const mocks = vi.hoisted(() => ({ upload: vi.fn(), product: vi.fn(), sign: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/store", () => ({ getProductById: mocks.product }));
vi.mock("@/lib/supabase", () => ({ getSupabase: () => ({ storage: { from: () => ({ upload: mocks.upload, createSignedUrl: mocks.sign }) } }) }));
import { generateProof } from "@/lib/proof";
import type { ShopOrder } from "@/lib/types";

describe("the reviewed mockup reaches the proof unchanged", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    mocks.product.mockResolvedValue({ variants: [{ id: "bone" }] });
    mocks.upload.mockResolvedValue({ error: null });
    mocks.sign.mockResolvedValue({ data: { signedUrl: "https://project.supabase.co/proof.png" } });
    mocks.upload.mockClear();
  });
  const url = (view: string) => `https://project.supabase.co/storage/v1/object/sign/artwork/mockups/12345678-abcd-abcd-abcd-123456789abc/${view}.webp?token=signed`;
  const order = { id: "test-order", productId: "tee", variantId: "bone", mockupUrls: { front: url("front"), back: url("back") }, artworkPlacements: [{ view: "front" }, { view: "back" }] } as ShopOrder;
  it("uses both saved renders instead of the legacy garment and generic artwork box", async () => {
    const red = await sharp({ create: { width: 100, height: 125, channels: 3, background: "red" } }).png().toBuffer();
    const blue = await sharp({ create: { width: 100, height: 125, channels: 3, background: "blue" } }).png().toBuffer();
    vi.stubGlobal("fetch", vi.fn(async (input: string) => new Response(new Uint8Array(input.includes("front.webp") ? red : blue))));
    expect(await generateProof(order, "https://shop.test")).toContain("proof.png");
    const saved = Buffer.from(mocks.upload.mock.calls[0][1]);
    const { data, info } = await sharp(saved).raw().toBuffer({ resolveWithObject: true });
    expect(info.width).toBe(2000);
    expect(info.height).toBe(1250);
    expect(data[0]).toBe(255);
    expect(data[(1500 * info.channels) + 2]).toBe(255);
  });
  it("fails visibly when a snapshot is missing instead of generating a misleading proof", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("missing", { status: 404 })));
    await expect(generateProof(order, "https://shop.test")).rejects.toThrow("Could not load front mockup");
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});
