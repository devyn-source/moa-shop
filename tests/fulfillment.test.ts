import { describe, it, expect, afterEach } from "vitest";
import { fulfillmentMode } from "@/lib/catalog-fulfillment";

// The fulfillment mode is a hard safety gate: it must default to "off" (nothing
// is released to vendors) and must reject unknown values back to "off".
const ORIG = process.env.CATALOG_FULFILLMENT_MODE;
afterEach(() => {
  if (ORIG === undefined) delete process.env.CATALOG_FULFILLMENT_MODE;
  else process.env.CATALOG_FULFILLMENT_MODE = ORIG;
});

describe("fulfillmentMode safety gate", () => {
  it("defaults to off when unset", () => {
    delete process.env.CATALOG_FULFILLMENT_MODE;
    expect(fulfillmentMode()).toBe("off");
  });
  it("passes through known modes (case-insensitive)", () => {
    process.env.CATALOG_FULFILLMENT_MODE = "AUTO";
    expect(fulfillmentMode()).toBe("auto");
    process.env.CATALOG_FULFILLMENT_MODE = "dry_run";
    expect(fulfillmentMode()).toBe("dry_run");
  });
  it("falls back to off on unknown values (fail-safe)", () => {
    process.env.CATALOG_FULFILLMENT_MODE = "ship_everything_now";
    expect(fulfillmentMode()).toBe("off");
  });
});
