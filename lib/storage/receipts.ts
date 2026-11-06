/**
 * receipts.ts — PRIVATE receipt storage client (server-only).
 *
 * Receipts (membership proof-of-payment and donation receipts) live in a
 * PRIVATE Supabase Storage bucket. They are NEVER publicly reachable: the
 * database stores only a private `file_key` (see `membership_receipts.file_key`
 * and `donations.file_key`), and the file is viewed only through a short-lived
 * (~300s) signed URL that a Staff/Admin context mints on demand.
 *
 * This module is the single storage boundary for that model:
 *   - `uploadReceipt(file)` validates the file, uploads it to the private
 *     bucket, and returns ONLY the `file_key` — never a public URL.
 *   - `createSignedUrl(fileKey)` mints a short-lived signed URL for a stored
 *     receipt. The role check (Staff/Admin only) is enforced by the calling
 *     route handler via `assertRole`; this function only mints the URL.
 *   - `validateReceiptFile(file)` is the shared content-type allow-list +
 *     size-cap validation reused by both membership and donation uploads.
 *
 * `import 'server-only'` guarantees a build-time error if this module is ever
 * imported into a Client Component, keeping all private-bucket access on the
 * server (design: "File access always goes through the server ... receipts are
 * fetched via short-lived signed URLs").
 *
 * NOTE: catalog images are NOT in object storage — they are static files under
 * `public/images/` referenced by a site-relative `image_url`. This module is
 * for receipts/donations only.
 *
 * Requirements: 10.1 (store privately, persist only the file key, never a
 * public URL), 10.2 (short-lived ~300s signed URL for viewing), 8.8 and 9.10
 * (reject disallowed content type or oversize file).
 */

import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * The PRIVATE storage bucket that holds all receipt files. This name is fixed
 * by the spec and must stay consistent across code and docs (Task 10): the
 * bucket a student creates in their own Supabase project is named `receipts`.
 */
export const RECEIPTS_BUCKET = "receipts";

/**
 * How long a minted signed URL stays valid, in seconds. The design fixes this
 * at approximately 300 seconds so a receipt is viewable only briefly after a
 * Staff/Admin reviewer requests it (Requirement 10.2).
 */
export const SIGNED_URL_TTL_SECONDS = 300;

/**
 * Maximum accepted receipt file size, in bytes (10 MiB). Receipts are GCash
 * screenshots or PDF proofs of payment, so a modest cap is ample and guards
 * against oversized uploads (Requirements 8.8, 9.10).
 */
export const MAX_RECEIPT_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Allowed receipt content types. The design's file-upload hardening rule is an
 * allow-list of any image type plus PDF. `image/*` is matched by prefix (see
 * `isAllowedContentType`); `application/pdf` is matched exactly.
 */
export const ALLOWED_RECEIPT_CONTENT_TYPE_PREFIX = "image/";
export const ALLOWED_RECEIPT_CONTENT_TYPES = ["application/pdf"] as const;

/**
 * The outcome of validating a candidate receipt file. `ok: false` carries a
 * reason the caller can surface as a 400 response (Requirements 8.8, 9.10).
 */
export type ReceiptFileValidation =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Returns true if `contentType` is on the receipt allow-list: any `image/*`
 * type, or `application/pdf`. An empty/missing content type is rejected.
 */
function isAllowedContentType(contentType: string): boolean {
  if (!contentType) {
    return false;
  }
  if (contentType.startsWith(ALLOWED_RECEIPT_CONTENT_TYPE_PREFIX)) {
    return true;
  }
  return (ALLOWED_RECEIPT_CONTENT_TYPES as readonly string[]).includes(
    contentType,
  );
}

/**
 * Shared file validation for both membership and donation receipt uploads.
 *
 * Enforces the content-type allow-list (image/*, application/pdf) and the size
 * cap. Returns a discriminated result rather than throwing so callers can map
 * a failure to a 400 response with the reason (Requirements 8.8, 9.10).
 */
export function validateReceiptFile(file: File): ReceiptFileValidation {
  if (!isAllowedContentType(file.type)) {
    return {
      ok: false,
      reason:
        "Unsupported file type. Upload an image or a PDF receipt.",
    };
  }
  if (file.size > MAX_RECEIPT_SIZE_BYTES) {
    return {
      ok: false,
      reason: `File is too large. The maximum size is ${
        MAX_RECEIPT_SIZE_BYTES / (1024 * 1024)
      } MB.`,
    };
  }
  return { ok: true };
}

/**
 * Derives the file extension (without the dot) from a content type so the
 * stored object keeps a sensible suffix. Falls back to `bin` for anything not
 * explicitly mapped.
 */
function extensionForContentType(contentType: string): string {
  switch (contentType) {
    case "application/pdf":
      return "pdf";
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default: {
      // image/<subtype> → <subtype>; otherwise a neutral fallback.
      if (contentType.startsWith(ALLOWED_RECEIPT_CONTENT_TYPE_PREFIX)) {
        return contentType.slice(ALLOWED_RECEIPT_CONTENT_TYPE_PREFIX.length);
      }
      return "bin";
    }
  }
}

/**
 * Builds an opaque, collision-resistant private storage key for a receipt. The
 * key is what gets persisted in `membership_receipts.file_key` /
 * `donations.file_key`; it is NOT a URL and never publicly addressable.
 */
function buildReceiptFileKey(file: File): string {
  const ext = extensionForContentType(file.type);
  // `crypto.randomUUID` is available in the Node/Edge runtimes Next.js uses on
  // the server. Group uploads under a `receipts/` prefix inside the bucket.
  const id = crypto.randomUUID();
  return `receipts/${id}.${ext}`;
}

/**
 * Uploads a receipt file to the PRIVATE bucket and returns ONLY its private
 * `file_key`.
 *
 * The file is validated first (content-type allow-list + size cap); an invalid
 * file throws so the calling route handler can respond 400 (Requirements 8.8,
 * 9.10). Upload runs through the role-aware server client so the request
 * carries the caller's session and storage access stays on the server.
 *
 * This NEVER returns a public URL and NEVER persists one — only the `file_key`,
 * which is later resolved to a short-lived signed URL via `createSignedUrl`
 * (Requirements 10.1, 10.3; Correctness Property 3).
 */
export async function uploadReceipt(file: File): Promise<string> {
  const validation = validateReceiptFile(file);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  const fileKey = buildReceiptFileKey(file);
  const supabase = createServerSupabaseClient();

  const { error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .upload(fileKey, file, {
      contentType: file.type,
      // Keys are unique per upload, so never overwrite an existing object.
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload receipt: ${error.message}`);
  }

  // Return ONLY the private key — never a public URL (Requirement 10.1).
  return fileKey;
}

/**
 * Mints a short-lived (~300s) signed URL granting temporary read access to a
 * stored receipt identified by its private `file_key` (Requirement 10.2).
 *
 * The signed URL is the ONLY way to view a receipt — there is no permanent
 * public URL (Requirement 10.3; Correctness Property 3). This function only
 * mints the URL; the Staff/Admin authorization that must precede it is enforced
 * by the calling route handler via `assertRole` (Requirement 10.4), consistent
 * with the `getReceiptViewUrl` algorithm in the design.
 */
export async function createSignedUrl(
  fileKey: string,
  expiresInSeconds: number = SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(fileKey, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(
      `Failed to create signed URL: ${error?.message ?? "no URL returned"}`,
    );
  }

  return data.signedUrl;
}
