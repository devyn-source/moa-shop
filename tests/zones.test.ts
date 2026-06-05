import { describe, it, expect } from "vitest";
import {
  derivePlacement,
  defaultCalibration,
  zoneFamily,
  isZoneSpecable,
  normaliseMeasurements,
  normaliseCalibration,
} from "@/lib/zones";

describe("derivePlacement", () => {
  // defaultCalibration: scaleAx 0.3, scaleBx 0.7 → span 0.4; realInches 20 → 50 in per width-fraction.
  const cal = defaultCalibration();

  it("converts a centered box to real inches", () => {
    const p = derivePlacement(cal, { x: 0.4, y: 0.2, w: 0.2, h: 0.1 }, { ox: 0, oy: 0, sx: 1, sy: 1 }, "front");
    expect(p.widthIn).toBe(10); // 0.2 * 50
    expect(p.heightIn).toBe(6.25); // 0.1 * 50 * 1.25
    expect(p.fromCenterIn).toBe(0);
    expect(p.horizontal).toBe("Centered");
  });

  it("reports wearer-relative horizontal off center (front view)", () => {
    const p = derivePlacement(cal, { x: 0.6, y: 0.2, w: 0.1, h: 0.1 }, { ox: 0, oy: 0, sx: 1, sy: 1 }, "front");
    expect(p.fromCenterIn).toBeGreaterThan(0);
    expect(p.horizontal).toContain("wearer's L of CF");
  });

  it("uses CB as the datum on the back view", () => {
    const p = derivePlacement(cal, { x: 0.6, y: 0.2, w: 0.1, h: 0.1 }, { ox: 0, oy: 0, sx: 1, sy: 1 }, "back");
    expect(p.horizontal).toContain("of CB");
  });

  it("scales the print box by the art transform", () => {
    const p = derivePlacement(cal, { x: 0.4, y: 0.2, w: 0.2, h: 0.2 }, { ox: 0, oy: 0, sx: 0.5, sy: 0.5 }, "front");
    expect(p.widthIn).toBe(5); // 0.2 * 0.5 * 50
  });
});

describe("zoneFamily", () => {
  it("maps category + zone to a family", () => {
    expect(zoneFamily("left-chest", "front", "tee")).toBe("front-body");
    expect(zoneFamily("center", "back", "tee")).toBe("back-body");
    expect(zoneFamily("sleeve-left", "front", "hoodie")).toBe("sleeve");
    expect(zoneFamily("any", "front", "headwear")).toBe("hat");
    expect(zoneFamily("any", "front", "bottoms")).toBe("bottom");
    expect(zoneFamily("any", "front", "bag")).toBe("bag");
  });
});

describe("isZoneSpecable (the placement gate)", () => {
  const cal = { front: defaultCalibration() };
  it("allows calibrated front/back body zones", () => {
    expect(isZoneSpecable("left-chest", "front", "tee", cal)).toBe(true);
  });
  it("blocks unsupported families (sleeves/hats)", () => {
    expect(isZoneSpecable("sleeve-left", "front", "hoodie", cal)).toBe(false);
    expect(isZoneSpecable("front", "front", "headwear", cal)).toBe(false);
  });
  it("blocks when the view has no calibration", () => {
    expect(isZoneSpecable("left-chest", "front", "tee", null)).toBe(false);
    expect(isZoneSpecable("center", "back", "tee", cal)).toBe(false); // no back cal
  });
});

describe("normalisers reject junk", () => {
  it("normaliseMeasurements rejects non-objects / missing rows", () => {
    expect(normaliseMeasurements(null)).toBeNull();
    expect(normaliseMeasurements({ unit: "in" })).toBeNull();
  });
  it("normaliseMeasurements keeps valid rows", () => {
    const m = normaliseMeasurements({ unit: "in", sampleSize: "M", rows: [{ pom: "Body Length", values: { M: 29 } }] });
    expect(m?.rows.length).toBe(1);
    expect(m?.rows[0].values.M).toBe(29);
  });
  it("normaliseCalibration returns null on junk, object on valid", () => {
    expect(normaliseCalibration(null)).toBeNull();
    expect(normaliseCalibration({ front: defaultCalibration() })?.front).toBeTruthy();
  });
});
