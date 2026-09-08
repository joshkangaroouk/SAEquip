import { apiJson } from "./api";
import type { MediaAsset } from "./types";

const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

/**
 * Two-step upload: the browser sends the bytes straight to Supabase Storage,
 * then the API records the asset.
 *
 * Why not just POST the file to /api/media like before: a serverless request
 * body cannot exceed 4.5MB on Vercel, far below the 25MB file and 50MB model
 * ceilings, so a 3D model could never reach the API at all. Going direct also
 * means a large file never sits in an API process's memory.
 *
 *   1. POST /api/media/upload-url  → signed, single-path upload URL
 *   2. PUT the file to that URL    → straight into the bucket
 *   3. POST /api/media             → records the MediaAsset and returns it
 *
 * Step 3 reads the real size and content type back from storage, so a wrong
 * claim from here cannot end up in the Media Centre.
 */

interface UploadTarget {
  kind: "image" | "file" | "model";
  bucket: string;
  path: string;
  token: string;
  signedUrl: string;
  maxBytes: number;
}

/**
 * PUT the bytes to the signed URL, reporting progress.
 *
 * Uses XMLHttpRequest rather than supabase-js's `uploadToSignedUrl` purely for
 * `upload.onprogress` — fetch cannot report request progress, and a 50MB
 * model with no progress bar looks like a hung page.
 *
 * ⚠️ The request shape mirrors supabase-js exactly, and two details are easy
 * to get wrong:
 *   - **PUT, not POST.** `/object/upload/sign/<bucket>/<path>` answers POST by
 *     minting *another* signed URL, so a POST returns a cheerful 200 whose body
 *     is a new URL and stores nothing at all.
 *   - The file's form field name is the **EMPTY STRING**. Not a typo — that is
 *     what Supabase's storage API looks for; naming it "file" fails.
 * Plus a `cacheControl` field and an `x-upsert` header.
 */
function putToSignedUrl(
  file: File,
  target: UploadTarget,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", file);

    const xhr = new XMLHttpRequest();
    xhr.open("PUT", target.signedUrl);
    xhr.setRequestHeader("x-upsert", "false");
    // Both headers are required: with no Authorization at all, Storage
    // refuses with "headers must have required property 'authorization'".
    //
    // The anon key is correct here and is public by design (it already ships
    // in the bundle for the Supabase client). What actually authorises the
    // write is the path-scoped token in the URL, which only our authenticated
    // /api/media/upload-url can mint — verified by testing the upload with and
    // without a `storage.objects` INSERT policy and with both the anon key and
    // a staff JWT: all four combinations behave identically, so the token is
    // the gate. Size and mimetype are capped by the bucket itself.
    xhr.setRequestHeader("Authorization", `Bearer ${SUPABASE_ANON_KEY}`);
    xhr.setRequestHeader("apikey", SUPABASE_ANON_KEY);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      let detail = `HTTP ${xhr.status}`;
      try {
        const body = JSON.parse(xhr.responseText);
        detail = body.message || body.error || detail;
      } catch {
        /* keep the status */
      }
      reject(new Error(detail));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));

    xhr.send(form);
  });
}

export async function uploadFile(
  file: File,
  opts: { alt?: string; onProgress?: (percent: number) => void } = {},
): Promise<MediaAsset> {
  const target = await apiJson<UploadTarget>("/api/media/upload-url", {
    method: "POST",
    body: JSON.stringify({ filename: file.name, mimeType: file.type || "application/octet-stream" }),
  });

  // Checked here for a useful message before spending the upload; the bucket
  // and the confirm step both enforce it regardless.
  if (file.size > target.maxBytes) {
    throw new Error(`${file.name} is ${formatMb(file.size)}, over the ${formatMb(target.maxBytes)} limit`);
  }

  await putToSignedUrl(file, target, opts.onProgress);

  return apiJson<MediaAsset>("/api/media", {
    method: "POST",
    body: JSON.stringify({ path: target.path, filename: file.name, alt: opts.alt }),
  });
}

function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
