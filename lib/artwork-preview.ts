import sharp from "sharp";
import path from "node:path";

// Keep the production original intact. The browser receives a separate, decoded
// image, including for PDF artwork and rotated/CMYK photographs.
export async function prepareArtworkPreview(bytes: Buffer, contentType: string) {
  let image = bytes;
  const vector = contentType === "application/pdf";
  if (vector) {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const root = path.join(process.cwd(), "node_modules/pdfjs-dist");
    const task = getDocument({
      data: new Uint8Array(bytes), useSystemFonts: true,
      cMapUrl: `${root}/cmaps/`, cMapPacked: true,
      standardFontDataUrl: `${root}/standard_fonts/`, wasmUrl: `${root}/wasm/`,
    });
    try {
      const pdf = await task.promise;
      if (pdf.numPages !== 1) throw new Error("Use a single-page PDF for each artwork placement.");
      const page = await pdf.getPage(1);
      const size = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: 3000 / Math.max(size.width, size.height) });
      const factory = pdf.canvasFactory as { create: (width: number, height: number) => { canvas: import("@napi-rs/canvas").Canvas; context: import("@napi-rs/canvas").SKRSContext2D }; destroy: (surface: unknown) => void };
      const surface = factory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));
      try {
        await page.render({ canvas: null, canvasContext: surface.context as unknown as CanvasRenderingContext2D, viewport, background: "rgba(0,0,0,0)" }).promise;
        image = surface.canvas.toBuffer("image/png");
      } finally { factory.destroy(surface); page.cleanup(); }
    } catch (error) {
      if (error instanceof Error && error.message.includes("single-page")) throw error;
      throw new Error("This PDF could not be previewed. Use an unlocked, single-page PDF or a PNG.");
    } finally { await task.destroy(); }
  }
  const original = await sharp(image, { limitInputPixels: 40_000_000 }).metadata();
  const { data, info } = await sharp(image, { limitInputPixels: 40_000_000 })
    .rotate().toColourspace("srgb").resize({ width: 4096, height: 4096, fit: "inside", withoutEnlargement: true })
    .png().toBuffer({ resolveWithObject: true });
  const rotated = !vector && [5, 6, 7, 8].includes(original.orientation ?? 0);
  return {
    bytes: data, width: info.width, height: info.height,
    sourceWidth: rotated ? original.height! : original.width!,
    sourceHeight: rotated ? original.width! : original.height!, vector,
  };
}
