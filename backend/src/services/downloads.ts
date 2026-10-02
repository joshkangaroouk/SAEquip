import type { Download, MediaAsset } from "@prisma/client";
import { publicImageUrl, resolveUrl } from "./storage.js";

/**
 * One download as the ADMIN sees it — the shape `GET /products/:id/custom`
 * returns and `PUT /products/:id/downloads` echoes back, so the editor's save
 * task can bank the response straight into its snapshot.
 *
 * ⚠️ Signing is caught PER ITEM. `/custom` loads the entire product editor,
 * and it signs every download inside a `Promise.all` — so one object missing
 * from `product-files` used to fail the whole request and the editor would not
 * open at all, for want of one preview link. A file that cannot be signed now
 * comes back with `url: null`, which the editor shows as a missing file on
 * that row, where the problem actually is.
 *
 * ⚠️ Signed whether or not the download is gated. This is an authenticated
 * admin view; withholding a gated file's URL from the people managing it (as
 * this used to) protected nothing, since the gate exists for visitors.
 */
export async function shapeHubDownload(d: Download & { mediaAsset: MediaAsset }) {
  let url: string | null = null;
  try {
    url = await resolveUrl(d.mediaAsset.kind, d.mediaAsset.storagePath);
  } catch {
    url = null;
  }
  return {
    id: d.id,
    title: d.title,
    kind: d.kind,
    certScheme: d.certScheme,
    gated: d.gated,
    sortOrder: d.sortOrder,
    mediaAssetId: d.mediaAssetId,
    file: {
      filename: d.mediaAsset.filename,
      mimeType: d.mediaAsset.mimeType,
      sizeBytes: d.mediaAsset.sizeBytes,
      url,
      thumbnailUrl: d.mediaAsset.thumbnailPath ? publicImageUrl(d.mediaAsset.thumbnailPath) : null,
    },
  };
}
