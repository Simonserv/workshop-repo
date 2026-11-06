# Task 6 — Implement the private storage client with signed-URL minting

Status: completed
Requirements: 10.1, 10.2, 8.8, 9.10

## What was built
The single server-side storage boundary for receipt files (membership
proof-of-payment and donation receipts). Receipts live in a PRIVATE Supabase
Storage bucket; the database persists only a private `file_key` (see
`membership_receipts.file_key` and `donations.file_key`), and a file is viewed
only through a short-lived (~300s) signed URL. A single new artifact,
`lib/storage/receipts.ts`, built on the Task 2.2 client factories.

Delivered:
- `uploadReceipt(file)` — validates the file, uploads it to the private
  `receipts` bucket via the role-aware server client, and returns ONLY the
  private `file_key`. It never returns and never persists a public URL
  (Requirement 10.1).
- `createSignedUrl(fileKey, expiresInSeconds = 300)` — mints a short-lived
  signed URL for a stored receipt (Requirement 10.2). The Staff/Admin
  authorization that must precede minting is enforced by the calling route
  handler via `assertRole` (Task 9.2), exactly as the design's
  `getReceiptViewUrl` algorithm describes; this function only mints the URL.
- `validateReceiptFile(file)` — the SHARED validation reused by both membership
  and donation uploads: a content-type allow-list (`image/*` by prefix plus
  `application/pdf`) and a size cap (`MAX_RECEIPT_SIZE_BYTES`, 10 MiB). Returns
  a discriminated `{ ok }` result so callers can map a failure to a 400
  (Requirements 8.8, 9.10).
- Exported constants `RECEIPTS_BUCKET` (`"receipts"`), `SIGNED_URL_TTL_SECONDS`
  (300), `MAX_RECEIPT_SIZE_BYTES`, and the allow-list values, so the bucket
  name and limits stay consistent across the app and with the docs.

## Design details honored
- **Receipts never publicly reachable** (Correctness Property 3; Requirement
  10): the only output of `uploadReceipt` is the `file_key`, and the only read
  path is a signed URL. No function returns or stores a permanent public URL.
- **Private bucket named `receipts`** — fixed by the spec and Task 10 so it
  stays consistent across code and the docs students follow when creating the
  bucket in their own project.
- **~300s signed-URL TTL** (Requirement 10.2) — `SIGNED_URL_TTL_SECONDS = 300`
  is the default expiry, matching the design's `createSignedUrl(file_key, 300s)`.
- **Server-only** — `import 'server-only'` makes any Client-Component import
  fail at build time, keeping all private-bucket access on the server ("File
  access always goes through the server … receipts are fetched via short-lived
  signed URLs"). Uploads use the role-aware server client (session JWT), not the
  anon browser client or the RLS-bypassing service-role client.
- **File-upload hardening** (design security principle 7) — content-type
  allow-list `image/*` + `application/pdf` plus a size cap, shared by both
  upload paths.

## Scope boundaries (deliberate)
- Storage client only — the membership/donation submit route handlers that call
  `uploadReceipt` / `validateReceiptFile` are Task 8.2/8.3; the Staff/Admin
  review dashboards that call `createSignedUrl` behind `assertRole` are Task
  9.2/9.3. This task provides the helpers they consume.
- Catalog images are explicitly out of scope — they are static files under
  `public/images/` referenced by a site-relative `image_url`, not object
  storage. This module is for receipts/donations only.
- No bucket provisioning — creating the private `receipts` bucket is a student
  step in Task 13.1 (Session 2); this is application code only.

## Files
- lib/storage/receipts.ts (new) — `uploadReceipt`, `createSignedUrl`,
  `validateReceiptFile`, and the bucket/TTL/size/allow-list constants.
- .kiro/specs/pos-catalog-site-core/tasks.md — marked Task 6 done.

## Verification
Type-check and production build, run once, both clean:
- `npx tsc --noEmit` — exit 0, no type errors.
- `npm run build` (`next build`) — compiled successfully; lint + type
  validation passed; 6 pages generated.

Static review confirmed against the cited requirements: `uploadReceipt` returns
only the `file_key` and never a public URL (10.1); `createSignedUrl` defaults to
a 300s expiry (10.2); `validateReceiptFile` enforces the `image/*` +
`application/pdf` allow-list and the size cap used by both membership (8.8) and
donation (9.10) uploads.

There is no live Supabase instance or `receipts` storage bucket in this
environment, so uploads and signed-URL minting could NOT be exercised at
runtime. Live storage verification is deferred to when a student provisions
their own Supabase project and creates the private `receipts` bucket (Task
13.1, Session 2).
