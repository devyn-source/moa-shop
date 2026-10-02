import { describe, expect, it } from "vitest";
import { artRectMm, checkPrintable, helperMaps2D, buildCoverage, inchesFromCentreMm, type PlateManifest } from "@/lib/plates";
import { readDesignDraft } from "@/lib/design-draft";
import { validMockupUrls } from "@/lib/mockup-urls";

describe("customer mockup placement", () => {
  const manifest: PlateManifest = { colours: { light: "#ccc" }, style: "tee" };
  it("retains wearer-relative placement when dragging either side", () => {
    for (const view of ["front", "back"] as const) {
      const placement = { id: "print", artUrl: "image", piece: view === "front" ? 1 : 2, widthIn: 3.5, belowHpsIn: 7.125, fromCfIn: 4.25 };
      const rect = artRectMm(placement, view, manifest, 2);
      const roundtrip = inchesFromCentreMm(rect.u0 + rect.w / 2, rect.vTop, view, manifest);
      expect(roundtrip.fromCfIn).toBeCloseTo(4.25);
      expect(roundtrip.belowHpsIn).toBeCloseTo(7.125);
      expect(rect.w / rect.h).toBe(2);
    }
  });
  it("blocks an uncheckable or out-of-bounds print instead of marking it printable", () => {
    const alpha = new Uint8ClampedArray(320 * 400 * 4);
    const cal = { w: 320, h: 400, pxPerIn: 16, cfX: 160, hpsY: 0 };
    let maps = helperMaps2D(alpha, 320, 400, 1, cal, "front");
    expect(checkPrintable(buildCoverage(maps.uv, maps.pieces, 1), { u0: 0, vTop: -50, w: 20, h: 20 }, .75).ok).toBe(false);
    for (let i = 3; i < alpha.length; i += 4) alpha[i] = 255;
    maps = helperMaps2D(alpha, 320, 400, 1, cal, "front");
    const coverage = buildCoverage(maps.uv, maps.pieces, 1);
    expect(checkPrintable(coverage, { u0: -30, vTop: -60, w: 60, h: 30 }, .75).ok).toBe(true);
    expect(checkPrintable(coverage, { u0: 900, vTop: -60, w: 60, h: 30 }, .75).ok).toBe(false);
  });
});

describe("recovering customer designs", () => {
  const saved = { version: 1, slug: "tee", savedAt: 1000, variantId: "bone", decorationIds: ["screen_print"], sizeQty: { M: 50 }, placements: [{ id: "left-chest", artUrl: "https://storage.test/logo.png", piece: 1, widthIn: 3.5, belowHpsIn: 7, fromCfIn: 4 }] };
  it("restores a valid design and rejects corrupt, expired or other-product data", () => {
    expect(readDesignDraft(saved, "tee", 2000)?.placements).toHaveLength(1);
    expect(readDesignDraft(saved, "hat", 2000)).toBeNull();
    expect(readDesignDraft(saved, "tee", 8 * 86400000)).toBeNull();
    expect(readDesignDraft({ ...saved, sizeQty: { M: -20 } }, "tee", 2000)).toBeNull();
    expect(readDesignDraft({ ...saved, placements: [...saved.placements, ...saved.placements] }, "tee", 2000)).toBeNull();
    expect(readDesignDraft({ ...saved, placements: [{ ...saved.placements[0], artUrl: "blob:expired" }] }, "tee", 2000)).toBeNull();
  });
});

describe("saved mockup references", () => {
  const origin = "https://project.supabase.co";
  const front = `${origin}/storage/v1/object/sign/artwork/mockups/12345678-abcd-abcd-abcd-123456789abc/front.webp?token=signed`;
  it("accepts own signed snapshots and rejects external URLs, wrong views and bucket paths", () => {
    expect(validMockupUrls({ front }, origin)).toBe(true);
    expect(validMockupUrls({ front: front.replace(origin, "https://other.test") }, origin)).toBe(false);
    expect(validMockupUrls({ back: front }, origin)).toBe(false);
    expect(validMockupUrls({ front: front.replace("/mockups/", "/originals/") }, origin)).toBe(false);
    expect(validMockupUrls({}, origin)).toBe(false);
  });
});
