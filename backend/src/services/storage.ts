import { supabase } from "../supabase.js";

/** Bucket names by media kind. */
export const BUCKETS = {
  image: "product-media", // PUBLIC — logo/cert images, readable via public URL
  file: "product-files", // PRIVATE — download files, access only via signed URLs
  model: "product-models", // PUBLIC — .glb 3D models; the live widget's <model-viewer> loads them unauthenticated
} as const;

export type BucketKind = keyof typeof BUCKETS;

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

/** Thrown on Supabase Storage failures; mapped to 502 by the error handler. */
export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}

/**
 * Upload ceilings per kind. Enforced by the BUCKET, not just by our routes.
 *
 * ⚠️ **A bucket limit cannot exceed the Supabase PROJECT's global upload
 * ceiling, which is currently 50MB.** Probed directly: `updateBucket` rejects
 * 150/100/75MB with "The object exceeded the maximum allowed size" and accepts
 * 50MB. So the 150MB that models were previously documented and coded to allow
 * was never actually achievable — a 150MB GLB would have failed inside
 * Supabase regardless of who was hosting the API. It went unnoticed because
 * the largest model in the library is 20MB.
 *
 * To genuinely raise it: Supabase dashboard → Project Settings → Storage →
 * "Upload file size limit" FIRST, then this constant, then re-run
 * `ensureBuckets()`.
 */
export const MAX_BYTES: Record<BucketKind, number> = {
  image: 25 * 1024 * 1024,
  file: 25 * 1024 * 1024,
  model: 50 * 1024 * 1024,
};

export const ALLOWED_IMAGE_MIME = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
export const ALLOWED_FILE_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
];

/**
 * Idempotently ensure the storage buckets exist WITH their size/type limits.
 *
 * ⚠️ The limits are the important part. Uploads go straight from the browser to
 * Supabase via a signed URL (see `createUploadTarget`), so our Express routes
 * never see the bytes and cannot enforce a ceiling — the bucket is the only
 * thing standing between a signed URL and someone pushing a gigabyte into it.
 *
 * Existing buckets are UPDATED, not skipped: the three buckets were originally
 * created with no limits at all, and a "create only what's missing" pass would
 * leave them that way forever.
 *
 * Models deliberately allow any mimetype: browsers report `.glb` inconsistently
 * (usually `application/octet-stream`), so a mimetype allowlist would reject
 * legitimate models. The size ceiling plus the server-issued `.glb`-derived
 * path is the guard there.
 */
export async function ensureBuckets(): Promise<void> {
  const { data: existing, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error("[storage] listBuckets failed:", error.message);
    return;
  }

  const names = new Set((existing ?? []).map((b) => b.name));
  const specs = [
    { id: BUCKETS.image, public: true, fileSizeLimit: MAX_BYTES.image, allowedMimeTypes: ALLOWED_IMAGE_MIME },
    { id: BUCKETS.file, public: false, fileSizeLimit: MAX_BYTES.file, allowedMimeTypes: ALLOWED_FILE_MIME },
    { id: BUCKETS.model, public: true, fileSizeLimit: MAX_BYTES.model, allowedMimeTypes: null },
  ];

  for (const spec of specs) {
    const options = {
      public: spec.public,
      fileSizeLimit: spec.fileSizeLimit,
      allowedMimeTypes: spec.allowedMimeTypes ?? undefined,
    };
    const { error: err } = names.has(spec.id)
      ? await supabase.storage.updateBucket(spec.id, options)
      : await supabase.storage.createBucket(spec.id, options);

    if (err) {
      console.error(`[storage] failed to ${names.has(spec.id) ? "update" : "create"} bucket "${spec.id}":`, err.message);
    } else {
      const mb = Math.round(spec.fileSizeLimit / 1024 / 1024);
      console.log(
        `[storage] bucket "${spec.id}" ${names.has(spec.id) ? "updated" : "created"} ` +
          `(${spec.public ? "public" : "private"}, max ${mb}MB)`,
      );
    }
  }
}

/**
 * Mint a short-lived, single-path signed upload URL for the browser.
 *
 * Why the browser uploads directly: a request body cannot exceed 4.5MB on
 * Vercel's serverless functions, which is far below the 25MB file and 50MB
 * model ceilings. Routing the bytes around the API removes that limit entirely
 * — and a large file was never worth buffering in an API process anyway.
 *
 * The token is scoped to exactly the `path` given, and the path is always
 * chosen server-side, so holding a URL grants no ability to write anywhere
 * else in the bucket.
 */
export async function createUploadTarget(
  kind: BucketKind,
  path: string,
): Promise<{ bucket: string; path: string; token: string; signedUrl: string }> {
  const { data, error } = await supabase.storage.from(BUCKETS[kind]).createSignedUploadUrl(path);
  if (error || !data) throw new StorageError(error?.message ?? "could not create upload URL");
  return { bucket: BUCKETS[kind], path: data.path, token: data.token, signedUrl: data.signedUrl };
}

/**
 * Real metadata for a stored object, or null if it isn't there.
 *
 * The authority on what was actually uploaded. Since the browser writes to
 * Supabase directly, the filename/type/size it reports afterwards are just
 * claims — this is what the confirm step validates against.
 *
 * Note the field is `contentType`, not `mimetype`.
 */
export async function objectInfo(
  kind: BucketKind,
  path: string,
): Promise<{ sizeBytes: number; contentType: string | null } | null> {
  const { data, error } = await supabase.storage.from(BUCKETS[kind]).info(path);
  if (error || !data) return null;
  const info = data as unknown as { size?: number; contentType?: string };
  return { sizeBytes: info.size ?? 0, contentType: info.contentType ?? null };
}

/** Upload a buffer to the bucket for the given kind. Throws StorageError. */
export async function uploadObject(
  kind: BucketKind,
  path: string,
  buffer: Buffer,
  contentType: string,
): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKETS[kind])
    .upload(path, buffer, { contentType, upsert: false });
  if (error) throw new StorageError(error.message);
}

/** Remove an object from the bucket for the given kind. Throws StorageError. */
export async function removeObject(kind: BucketKind, path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKETS[kind]).remove([path]);
  if (error) throw new StorageError(error.message);
}

/**
 * Resolve a usable URL for an asset: a public URL for images/models, a
 * short-lived signed URL for private files.
 */
export async function resolveUrl(kind: string, storagePath: string): Promise<string> {
  if (kind === "image") return publicImageUrl(storagePath);
  if (kind === "model") return publicModelUrl(storagePath);
  return signedFileUrl(storagePath, SIGNED_URL_TTL_SECONDS);
}

/** Public URL for an object in a public bucket. Constructed locally — no network. */
function publicUrlFor(kind: "image" | "model", storagePath: string): string {
  return supabase.storage.from(BUCKETS[kind]).getPublicUrl(storagePath).data.publicUrl;
}

/** Public URL for an image in the public bucket. */
export function publicImageUrl(storagePath: string): string {
  return publicUrlFor("image", storagePath);
}

/** Public URL for a 3D model in the public models bucket. */
export function publicModelUrl(storagePath: string): string {
  return publicUrlFor("model", storagePath);
}

/** Create a signed URL for a private file with a custom TTL (seconds). */
export async function signedFileUrl(storagePath: string, ttlSeconds: number): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKETS.file)
    .createSignedUrl(storagePath, ttlSeconds);
  if (error || !data) throw new StorageError(error?.message ?? "failed to sign url");
  return data.signedUrl;
}
