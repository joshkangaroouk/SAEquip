/**
 * Verify the direct-to-Supabase upload path, and re-apply the bucket limits.
 *
 *   npm run media:verify-upload --workspace=backend
 *
 * Worth keeping rather than deleting: `frontend/src/lib/upload.ts` hand-copies
 * the request shape out of supabase-js (PUT, not POST; file field named with
 * the EMPTY STRING) so it can use XMLHttpRequest and show upload progress. If
 * a supabase-js upgrade changes that shape, nothing in a type-check or build
 * will notice — this script will. It also proves the bucket still rejects
 * oversize and disallowed-mimetype uploads, which is the only enforcement left
 * now that the bytes bypass the API.
 *
 * Safe: uploads a 78-byte PNG to a random path and deletes it.
 */
import { createUploadTarget, objectInfo, removeObject, ensureBuckets, MAX_BYTES } from "../services/storage.js";
import { readFileSync } from "node:fs";
import { supabase } from "../supabase.js";

/** Exactly what putToSignedUrl() in the frontend does — note PUT, not POST. */
async function browserUpload(signedUrl: string, bytes: Buffer, contentType: string, token?: string) {
  const form = new FormData();
  form.append("cacheControl", "3600");
  form.append("", new Blob([new Uint8Array(bytes)], { type: contentType }), "upload.bin");

  // Mirrors the frontend exactly, including the Authorization/apikey headers
  // Supabase Storage requires even though the URL carries a scoped token.
  const key = token ?? anonKey();
  const res = await fetch(signedUrl, {
    method: "PUT",
    headers: { "x-upsert": "false", Authorization: `Bearer ${key}`, apikey: anonKey() },
    body: form,
  });
  return { status: res.status, ok: res.ok, body: (await res.text()).slice(0, 300) };
}

/** The browser uses the ANON key, so mirror that rather than the service role
 *  key — the service role bypasses bucket limits and would hide failures. */
function anonKey(): string {
  const envFile = readFileSync("../frontend/.env", "utf8");
  const m = /^VITE_SUPABASE_ANON_KEY\s*=\s*"?([^"\n]+)"?/m.exec(envFile);
  if (!m) throw new Error("VITE_SUPABASE_ANON_KEY not found in frontend/.env");
  return m[1].trim();
}

/** Sign in as staff to get a real `authenticated` JWT, exactly as the browser has. */
async function staffToken(): Promise<string> {
  const url = /^SUPABASE_URL\s*=\s*"?([^"\n]+)"?/m.exec(readFileSync(".env", "utf8"))![1].trim();
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey(), "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@saequip.com", password: "Test123" }),
  });
  const body = (await res.json()) as { access_token?: string; error_description?: string };
  if (!body.access_token) throw new Error(`sign-in failed: ${body.error_description ?? JSON.stringify(body).slice(0, 120)}`);
  return body.access_token;
}

async function main() {
  console.log("=== applying bucket limits ===");
  await ensureBuckets();

  console.log("\n=== bucket config as Supabase now reports it ===");
  const { data: buckets } = await supabase.storage.listBuckets();
  for (const b of buckets ?? []) {
    const limit = (b as unknown as { file_size_limit?: number }).file_size_limit;
    const mimes = (b as unknown as { allowed_mime_types?: string[] | null }).allowed_mime_types;
    console.log(
      `  ${b.name.padEnd(16)} public=${String(b.public).padEnd(5)} limit=${limit ? Math.round(limit / 1048576) + "MB" : "none"} mimes=${mimes ? mimes.length : "any"}`,
    );
  }

  // 1x1 PNG.
  const png = Buffer.from(
    "89504e470d0a1a0a0000000d494844520000000100000001080600000" +
      "01f15c4890000000d49444154789c63f8cfc0500f0004000100ff" +
      "ff03000006000557bfabd40000000049454e44ae426082",
    "hex",
  );

  console.log("\n=== round trip: mint URL -> browser-shaped PUT  -> confirm ===");
  const path = `images/${crypto.randomUUID()}-test-upload.png`;
  const target = await createUploadTarget("image", path);
  console.log(`  minted signed URL for ${target.path}`);

  const put = await browserUpload(target.signedUrl, png, "image/png");
  console.log(`  browser-shaped PUT  -> ${put.status} ${put.ok ? "OK" : "FAILED"}`);
  console.log(`  response body: ${put.body}`);

  const listed = await supabase.storage.from("product-media").list("images", { search: path.split("/")[1] });
  console.log(`  bucket list at that prefix: ${JSON.stringify(listed.data?.map((o) => o.name))}`);

  const info = await objectInfo("image", path);
  console.log(`  objectInfo -> ${info ? `size=${info.sizeBytes} contentType=${info.contentType}` : "NOT FOUND"}`);
  const sizeMatches = info?.sizeBytes === png.byteLength;
  console.log(`  size matches what we sent: ${sizeMatches ? "yes" : `NO (${info?.sizeBytes} vs ${png.byteLength})`}`);

  await removeObject("image", path);
  console.log(`  cleaned up`);

  console.log("\n=== does the bucket reject a file over its limit? ===");
  const big = Buffer.alloc(MAX_BYTES.image + 1024, 0);
  const bigPath = `images/${crypto.randomUUID()}-too-big.png`;
  const bigTarget = await createUploadTarget("image", bigPath);
  const bigPut = await browserUpload(bigTarget.signedUrl, big, "image/png");
  console.log(`  ${Math.round(big.byteLength / 1048576)}MB upload -> ${bigPut.status} ${bigPut.ok ? "*** ACCEPTED (limit not enforced!) ***" : "rejected: " + bigPut.body.slice(0, 120)}`);
  if (bigPut.ok) await removeObject("image", bigPath);

  console.log("\n=== does the bucket reject a disallowed mimetype? ===");
  const exePath = `images/${crypto.randomUUID()}-bad.png`;
  const exeTarget = await createUploadTarget("image", exePath);
  const exePut = await browserUpload(exeTarget.signedUrl, png, "application/x-msdownload");
  console.log(`  application/x-msdownload -> ${exePut.status} ${exePut.ok ? "*** ACCEPTED ***" : "rejected: " + exePut.body.slice(0, 120)}`);
  if (exePut.ok) await removeObject("image", exePath);

  console.log(
    `\n${put.ok && sizeMatches ? "✓ the browser's request shape works and metadata reads back correctly" : "✗ upload path is broken"}\n`,
  );
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
