import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

/**
 * PDF page rendering for SCRIPTS — the backfill, and the tests that exercise
 * the thumbnail route with a real preview.
 *
 * ⚠️ Its own module, with no side effects, because the obvious place for it —
 * the backfill script — runs `main()` on import. Importing the renderer from
 * there once executed the whole script, including its `finally` that
 * disconnects the shared Prisma client mid-test.
 *
 * ⚠️ Script-only. `@napi-rs/canvas` is a ~30MB native binary and a
 * devDependency: nothing the SERVER imports may reach this file, or it lands
 * in the one function that serves the dashboard and the public widget.
 */

/** Fits a landscape datasheet and a portrait A4 certificate alike. */
export const MAX_W = 480;
export const MAX_H = 680;
const WEBP_QUALITY = 80;

/**
 * Page 1 to WebP.
 *
 * Painted onto white first: a PDF page with no background is transparent, and
 * a transparent WebP over the grey tile reads as a blank or broken preview.
 */
export async function renderFirstPage(pdf: Buffer): Promise<Buffer> {
  // pdfjs takes ownership of the array, so hand it a copy rather than a view
  // of a buffer the caller may still be using.
  // (v6 dropped `isEvalSupported` along with the eval-based font path it
  // controlled, and moved `destroy()` onto the loading task.)
  const task = getDocument({ data: new Uint8Array(pdf), disableFontFace: true, verbosity: 0 });
  const doc = await task.promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(MAX_W / base.width, MAX_H / base.height);
    const vp = page.getViewport({ scale });
    const canvas = createCanvas(Math.max(1, Math.round(vp.width)), Math.max(1, Math.round(vp.height)));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx as never, viewport: vp, canvas: canvas as never }).promise;
    return canvas.toBuffer("image/webp", WEBP_QUALITY);
  } finally {
    await task.destroy();
  }
}
