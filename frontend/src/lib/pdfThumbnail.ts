/**
 * Render a PDF's first page to an image, in the browser, at upload time.
 *
 * The live half of PDF previews. The backfill (`media:pdf-thumbnails`)
 * rendered the 126 imported files; this covers anything uploaded since, and it
 * stays in sync with that script on size and format so a preview made here and
 * one made there look the same.
 *
 * Rendered HERE rather than on the server because the server version needs a
 * ~30MB native canvas, and the API is one function that also serves the whole
 * dashboard and the public widget — every cold start would pay for it. The
 * browser already has the file's bytes and a canvas, so nothing is downloaded
 * twice and nothing heavy is deployed.
 *
 * ⚠️ pdf.js (~1MB with its worker) is imported LAZILY, only when a PDF is
 * actually uploaded, so it never touches the bundle every page loads.
 */

/** Same box as the backfill: fits a landscape datasheet and a portrait A4 certificate. */
const MAX_W = 480;
const MAX_H = 680;

export async function renderPdfThumbnail(file: Blob): Promise<Blob> {
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), verbosity: 0 });
  try {
    const doc = await task.promise;
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(MAX_W / base.width, MAX_H / base.height) });

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d canvas");
    // A page with no background is transparent, which reads as blank on a grey tile.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    /*
     * WebP, which is ~4x smaller than PNG for these pages. A browser that
     * cannot ENCODE WebP returns PNG from toBlob instead of failing, which is
     * why the server sniffs the bytes rather than trusting the type — and why
     * the caller sends `blob.type` as the content type.
     */
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.8));
    if (!blob) throw new Error("the canvas produced no image");
    return blob;
  } finally {
    await task.destroy();
  }
}

/** A PDF by type or, when the browser reports no type, by name. */
export const isPdf = (file: File) => file.type === "application/pdf" || /\.pdf$/i.test(file.name);
