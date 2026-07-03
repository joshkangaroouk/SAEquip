import { supabase } from "../supabase.js";

/** Bucket names by media kind. */
export const BUCKETS = {
  image: "product-media", // PUBLIC — logo/cert images, readable via public URL
  file: "product-files", // PRIVATE — download files, access only via signed URLs
} as const;

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

/** Thrown on Supabase Storage failures; mapped to 502 by the error handler. */
export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}

/**
 * Idempotently ensure the two storage buckets exist. Creates only what's
 * missing and logs which were created vs already present. Non-fatal on error.
 */
export async function ensureBuckets(): Promise<void> {
  const { data: existing, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error("[storage] listBuckets failed:", error.message);
    return;
  }

  const names = new Set((existing ?? []).map((b) => b.name));
  const specs = [
    { id: BUCKETS.image, public: true },
    { id: BUCKETS.file, public: false },
  ];

  for (const spec of specs) {
    if (names.has(spec.id)) {
      console.log(`[storage] bucket "${spec.id}" already exists`);
      continue;
    }
    const { error: createErr } = await supabase.storage.createBucket(spec.id, {
      public: spec.public,
    });
    if (createErr) {
      console.error(`[storage] failed to create bucket "${spec.id}":`, createErr.message);
    } else {
      console.log(`[storage] created bucket "${spec.id}" (${spec.public ? "public" : "private"})`);
    }
  }
}

/** Upload a buffer to the bucket for the given kind. Throws StorageError. */
export async function uploadObject(
  kind: "image" | "file",
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
export async function removeObject(kind: "image" | "file", path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKETS[kind]).remove([path]);
  if (error) throw new StorageError(error.message);
}

/**
 * Resolve a usable URL for an asset: a public URL for images, a short-lived
 * signed URL for private files.
 */
export async function resolveUrl(kind: string, storagePath: string): Promise<string> {
  if (kind === "image") {
    return supabase.storage.from(BUCKETS.image).getPublicUrl(storagePath).data.publicUrl;
  }
  return signedFileUrl(storagePath, SIGNED_URL_TTL_SECONDS);
}

/** Create a signed URL for a private file with a custom TTL (seconds). */
export async function signedFileUrl(storagePath: string, ttlSeconds: number): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKETS.file)
    .createSignedUrl(storagePath, ttlSeconds);
  if (error || !data) throw new StorageError(error?.message ?? "failed to sign url");
  return data.signedUrl;
}
