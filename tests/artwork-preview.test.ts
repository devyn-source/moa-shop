import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { prepareArtworkPreview } from "@/lib/artwork-preview";

function pdf(pages = 1) {
  const stream = "1 0 0 rg 20 20 100 60 re f";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [3 0 R${pages === 2 ? " 5 0 R" : ""}] /Count ${pages} >>`,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] /Resources << >> /Contents 4 0 R >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    ...(pages === 2 ? ["<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] /Resources << >> /Contents 4 0 R >>"] : []),
  ];
  let out = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, i) => { offsets.push(Buffer.byteLength(out)); out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out);
}

describe("artwork preview preparation", () => {
  it("renders a PDF without discarding its transparent background", async () => {
    const preview = await prepareArtworkPreview(pdf(), "application/pdf");
    expect(preview.vector).toBe(true);
    expect(preview.width).toBe(3000);
    expect(preview.height).toBe(1500);
    const { data, info } = await sharp(preview.bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(data[3]).toBe(0);
    const centre = (750 * info.width + 1000) * 4;
    expect(data[centre]).toBeGreaterThan(245);
    expect(data[centre + 3]).toBe(255);
  }, 20000);
  it("rejects multiple pages instead of silently using the wrong artwork", async () => {
    await expect(prepareArtworkPreview(pdf(2), "application/pdf")).rejects.toThrow("single-page");
  });
  it("corrects EXIF rotation and retains the source pixel dimensions for print checks", async () => {
    const original = await sharp({ create: { width: 600, height: 1000, channels: 3, background: "red" } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const preview = await prepareArtworkPreview(original, "image/jpeg");
    expect([preview.width, preview.height]).toEqual([1000, 600]);
    expect([preview.sourceWidth, preview.sourceHeight]).toEqual([1000, 600]);
  });
});
