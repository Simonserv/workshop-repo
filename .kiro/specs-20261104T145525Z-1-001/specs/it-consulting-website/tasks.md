# Implementation Plan: IT Consulting Website (Three-Tier Workshop Build)

## Overview

This plan implements the three-tier IT consulting website in Node/JavaScript using Vercel Serverless Functions (Application layer), PostgreSQL via Supabase (Data layer), and a plain/lightweight frontend (Presentation layer), with Supabase Storage for private receipts and Supabase Auth for authentication.

The build order follows the three-tier architecture from the bottom up: first the Data layer (schema, DB/storage clients), then shared Application-layer helpers (RBAC middleware, validation, parameterized query helpers, signed-URL minting), then the domain services (Listings, Inquiry, Membership, Donation, Auth), and finally the Presentation layer wiring and dashboards. Security rules are non-negotiable and are built into the shared helpers so every endpoint reuses them.

Implementation language: **JavaScript (Node, ESM)** — fixed by the finalized stack in the tech steering. Tests use Vitest with `fast-check` for property-based tests. Parameterized queries, backend-enforced RBAC, private receipt storage, input validation/sanitization, and file-upload hardening are enforced throughout.

**Current progress:** The Data layer (`db/`) and shared Application helpers (`api/_lib/`) are complete with passing tests. The Listings service (public read + Admin service logic) and the Inquiry service (public submission + Staff/Admin management) are implemented; the public-listings unit tests pass. Membership, Donations, the Auth/registration flow, the Presentation layer, and most property/unit tests are still outstanding. Remaining work is reflected in the task statuses below.

## Tasks

- [x] 1. Set up project structure, data layer, and shared clients
  - [x] 1.1 Scaffold repo structure and tooling
    - Create the tier-separated layout: `api/` (serverless functions grouped by domain: `services/`, `inquiries/`, `auth/`, `membership/`, `donations/`, `_lib/`), `public/` (frontend), and `db/` (schema, migrations, seed)
    - Initialize `package.json` (ESM, Node >= 20), install the Supabase JS SDK and `jsonwebtoken`, and add Vitest + `fast-check` as dev dependencies with `test`/`test:watch`/`test:coverage` scripts
    - Add environment-variable config loading (`api/_lib/config.js`) for Supabase keys, JWT config, and storage/upload limits (server-side only, never in frontend); add `.env.example`
    - _Requirements: 7.1_

  - [x] 1.2 Define the database schema and migrations
    - Write SQL in `db/` (`schema.sql`, `migrations/0001_init.sql`) for `app_user`, `listing`, `inquiry`, `membership_receipt`, and `donation` tables with the exact column/enum names from the design (`role`, `membership_status`, `inquiry_type`, `is_active`, `file_key`, `status`, `reviewed_by`, etc.); `app_user` is tied 1:1 to Supabase `auth.users` (password hashing owned by Supabase Auth)
    - Add foreign keys (`inquiry.listing_id`→listing, `membership_receipt.user_id`→app_user, `membership_receipt.reviewed_by`/`donation.reviewed_by`→app_user), defaults (`role=USER`, `membership_status=NON_MEMBER`, statuses default `PENDING`/`NEW`, `is_active=true`), and a `CHECK (amount > 0)` constraint on `donation`
    - Add indexes on `inquiry.status`, `membership_receipt.status`, `donation.status`, `listing.is_active` plus supporting FK indexes
    - Add `db/seed.sql`: sample active/inactive listings and one Admin user
    - _Requirements: 1.1, 2.1, 3.2, 7.2_

  - [x] 1.3 Implement the shared DB client with parameterized query helper
    - Create `api/_lib/db.js` exposing query helpers that execute **only** parameterized statements via the Supabase query builder (no string concatenation); table names are restricted to a fixed allow-list and the raw-SQL `rpc` escape hatch rejects interpolated strings
    - Provide typed-ish accessors used by services (findUserById, findListingById, findReceiptById, findDonationById, findInquiryById, getActiveListings, findInquiries) plus generic insert/update helpers
    - _Requirements: 7.2_

  - [x] 1.4 Implement the shared private storage client with signed-URL minting
    - Create `api/_lib/storage.js` with `uploadReceipt(file, opts)` that uploads to a **private** Supabase bucket and returns only the private `file_key`
    - Expose `createSignedUrl(file_key, expiresInSeconds=~300)` that mints a short-lived signed URL; never return or persist a public URL
    - _Requirements: 5.1, 5.2_

  - [x] 1.5 Implement shared input validation, sanitization, file-upload hardening, and error helpers
    - Create `api/_lib/validation.js` with `isNonEmpty`, `isValidEmail`, `sanitizeText` (XSS-safe HTML escaping for dashboard rendering), `isAllowedContentType`, and `validateFile` enforcing a content-type allow-list (`image/*`, `application/pdf`) and a configured size cap
    - Create `api/_lib/errors.js` for generic client error responses (no stack traces/secrets) with the status conventions (400/401/403/409/500)
    - _Requirements: 7.1, 7.3, 7.4_

  - [x]* 1.6 Write unit tests for config, DB client, storage, and validation helpers
    - Test config fail-fast/defaults, DB parameterized-query/allow-list/rpc behavior, storage returns a private key + ~300s signed URL, and validation email/empty/sanitizer/allow-list/size-cap paths
    - _Requirements: 7.2, 7.3, 7.4, 5.1, 5.2_

- [ ] 2. Implement Auth & RBAC middleware (the heart of backend security)
  - [x] 2.1 Implement `requireRole` authentication + authorization middleware
    - Create `api/_lib/requireRole.js` implementing the design's `requireRole`: extract bearer token, verify signature/expiry (HS256, audience/issuer when configured), load the user from the DB, and authorize using the **persisted** role (never a client-supplied value)
    - Return 401 for missing/invalid token or unknown user; 403 when the DB role is not in the allowed set; otherwise return an `AuthContext {userId, role}`
    - Provide an explicit `publicEndpoint` pass-through (no auth) for listings retrieval, inquiry submission, donation payment info, and donation submission
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 2.2 Write property test for privileged-endpoint authorization
    - **Property 2: Privileged endpoints always require authorization**
    - **Validates: Requirements 4.4**

  - [ ]* 2.3 Write property test for RBAC trusting the database, not the client
    - **Property 7: RBAC trusts the database, not the client**
    - **Validates: Requirements 4.4**

  - [ ]* 2.4 Write unit tests for 401 vs 403 paths
    - Test missing token, invalid/expired token, unknown user (401), and valid token with insufficient role (403); confirm the token's role claim is ignored in favor of the DB role
    - _Requirements: 4.1, 4.2, 4.3_

- [ ] 3. Checkpoint - foundations and security middleware
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement Listings Service
  - [x] 4.1 Implement public listings retrieval and single-listing lookup
    - Create `api/services/` endpoints: `index.js` (`getActiveListings()` returns only listings with `is_active = true`) and `[id].js` (`getListingById(id)` returns a listing or NotFound); business logic lives in `listingsService.js`
    - No authentication required for retrieval (wrapped in `publicEndpoint`)
    - _Requirements: 1.1, 4.5_

  - [x] 4.2 Implement Admin-only listing create/update/deactivate service logic
    - Create `listingsAdminService.js` with validated, sanitized `createListing`/`updateListing`/`deactivateListing` (enum checks, parameterized persistence), returning a discriminated result for the handler to forward
    - _Requirements: 4.6_

  - [ ] 4.3 Wire the Admin-only listings HTTP handler with `requireRole(ADMIN)`
    - Add a serverless handler (e.g. `api/services/manage.js`) that calls `requireRole(req, ['ADMIN'])` before delegating to `listingsAdminService` create/update/deactivate, forwarding the service's `{status, body}` result and mapping unexpected failures to a generic 500
    - _Requirements: 4.6, 7.1_

  - [x]* 4.4 Write unit tests for public Listings retrieval
    - Test that inactive listings are excluded from public retrieval and that single lookup returns NotFound for missing ids
    - _Requirements: 1.1_

  - [ ]* 4.5 Write unit tests for Admin listing management and authorization
    - Test create/update/deactivate validation and that non-Admins are rejected (403) at the handler
    - _Requirements: 4.6_

- [ ] 5. Implement Inquiry Service
  - [x] 5.1 Implement public inquiry submission with validation and active-listing check
    - Create `api/inquiries/index.js` submit endpoint (no auth) and `inquiryService.js` implementing the design's `submitInquiry`: validate non-empty name, well-formed email, non-empty details; reject missing/invalid fields with 400 + field-level errors
    - Look up `listing_id`; reject with 400 if the listing is inactive or non-existent; sanitize `customer_name` and `project_details`; persist with status `NEW` and return 201 with the inquiry id
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 4.5_

  - [ ]* 5.2 Write property test for inquiry integrity
    - **Property 4: Inquiry integrity** (every persisted inquiry references a listing active at submission time)
    - **Validates: Requirements 1.2**

  - [ ]* 5.3 Write unit tests for inquiry validation and sanitization
    - Test field-level 400 errors, inactive/non-existent listing rejection, and sanitization of name/details
    - _Requirements: 1.3, 1.5, 1.6_

  - [x] 5.4 Implement Staff/Admin inquiry listing and status management
    - Implement `inquiryAdminService.js` (`listInquiries(staffCtx, filter)` status-filtered; `updateInquiryStatus(staffCtx, id, status)` to `IN_PROGRESS`/`CLOSED`) and wire `api/inquiries/manage.js` guarded by `requireRole(['STAFF','ADMIN'])`
    - Ensure inquiry text is escaped/sanitized when returned for dashboard rendering
    - _Requirements: 4.7, 6.2, 6.3, 7.3_

  - [ ]* 5.5 Write unit tests for inquiry management and filtering
    - Test status-filter correctness, update-to-IN_PROGRESS/CLOSED persistence, render-time sanitization, and that only Staff/Admin may manage inquiries
    - _Requirements: 4.7, 6.2, 6.3, 7.3_

- [ ] 6. Implement Membership Service
  - [ ] 6.1 Implement registration and payment-info endpoints
    - Create `api/auth/register` using Supabase Auth: create an `app_user` with role `USER` and `membership_status NON_MEMBER`; reject already-registered or malformed emails; passwords handled by Supabase Auth (never plaintext)
    - Add `api/membership/payment-info` returning the GCash QR payment info
    - Add `getMyMembership(userCtx)` returning the authenticated user's current `membership_status`
    - _Requirements: 2.1, 2.2, 2.3, 2.9, 2.10_

  - [ ] 6.2 Implement membership receipt upload (private storage)
    - Create `api/membership/receipt` (authenticated User): validate the file against `validateFile`, store it privately via `uploadReceipt` (persist only `file_key`), and persist a `membership_receipt` with status `PENDING`
    - Reject disallowed type/oversized files with 400
    - _Requirements: 2.4, 5.1, 7.4_

  - [ ] 6.3 Implement transactional receipt approval and rejection
    - Create Staff/Admin endpoints implementing the design's `approveReceipt`: if the receipt is not `PENDING` return 409; otherwise, in a **single atomic transaction** (Postgres function via `db.rpc`), set receipt `APPROVED` + `reviewed_by` and set the owning user's `membership_status` to `MEMBER` (the only path that grants membership)
    - Implement reject: set status `REJECTED`, record `reviewed_by` and rejection reason; return 409 if not `PENDING`
    - Guard both with `requireRole(['STAFF','ADMIN'])`
    - _Requirements: 2.5, 2.6, 2.7, 2.8, 4.7_

  - [ ] 6.4 Implement pending-receipts listing with signed view URLs
    - Create Staff/Admin `listPendingReceipts` returning only `PENDING` receipts, each paired with a ~300s signed view URL, ordered by `created_at`
    - Implement `getReceiptViewUrl(staffCtx, receiptId)` per the design: deny non-Staff/Admin without issuing a URL; mint a short-lived signed URL otherwise
    - _Requirements: 5.2, 5.3, 5.4, 6.1_

  - [ ]* 6.5 Write property test for membership granted only by approval
    - **Property 1: Membership is only granted by approval**
    - **Validates: Requirements 2.5**

  - [ ]* 6.6 Write property test for terminal, single review (membership receipts)
    - **Property 5: Review is terminal and single** (re-reviewing a non-PENDING receipt returns 409)
    - **Validates: Requirements 2.6**

  - [ ]* 6.7 Write property test for receipts never publicly reachable
    - **Property 3: Receipts are never publicly reachable** (only a Staff/Admin-minted signed URL can view a `file_key`; no stored public URL)
    - **Validates: Requirements 5.3**

  - [ ]* 6.8 Write unit tests for registration and membership status
    - Test duplicate/malformed email rejection and that `getMyMembership` returns the persisted status
    - _Requirements: 2.2, 2.9_

- [ ] 7. Checkpoint - listings, inquiries, and membership
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement Donation Service
  - [ ] 8.1 Implement public donation submission with amount and file validation
    - Create `api/donations/` payment-info (public) and submit (public, no auth) endpoints implementing the design's `submitDonation`: reject `amount <= 0` with 400; validate the receipt file (allow-list + size cap) and store it privately (persist only `file_key`); persist the Donation with status `PENDING`
    - Handle donor fields: both omitted → anonymous (null/null); exactly one provided → persist that field, other null (non-anonymous)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.10, 3.9, 4.5, 7.4_

  - [ ]* 8.2 Write property test for donation amount validity
    - **Property 6: Donation amount validity** (donations with non-positive amount are never persisted)
    - **Validates: Requirements 3.2**

  - [ ]* 8.3 Write unit tests for donor-field anonymity handling and file validation
    - Test both-omitted, exactly-one-provided, and disallowed/oversized file rejection
    - _Requirements: 3.5, 3.10, 3.9_

  - [ ] 8.4 Implement Staff/Admin donation verify/reject and listing
    - Add verify (set `VERIFIED`, record `reviewed_by`) and reject (set `REJECTED`, record `reviewed_by` + reason); return 409 if the donation is not `PENDING`
    - Add status-filtered `listDonations` for Admin; guard review/list actions with `requireRole(['STAFF','ADMIN'])`
    - Reuse `getReceiptViewUrl`-style signed URLs for donation receipts (Staff/Admin only)
    - _Requirements: 3.6, 3.7, 3.8, 4.7, 5.2, 5.4, 6.4_

  - [ ]* 8.5 Write property test for terminal, single review (donations)
    - **Property 5: Review is terminal and single** (re-reviewing a non-PENDING donation returns 409)
    - **Validates: Requirements 3.8**

  - [ ]* 8.6 Write unit tests for donation review and filtering
    - Test verify/reject state recording, 409 on non-PENDING, and status-filter correctness
    - _Requirements: 3.6, 3.7, 3.8, 6.4_

- [ ] 9. Implement Presentation layer and wire everything together
  - [ ] 9.1 Build public frontend: listings, per-type inquiry forms, donation form
    - Replace the `public/index.html` scaffold: render active listings; show the inquiry form matching each listing's `inquiry_type` (DEMO/QUOTE/INQUIRE); build the donation form (optional donor fields + receipt upload); all calls go through the API only
    - _Requirements: 1.8, 3.1_

  - [ ] 9.2 Build auth UI and membership flow
    - Register/login UI (Supabase Auth), payment-info/QR display, receipt upload, and "my membership status" view; attach JWT to authenticated requests
    - _Requirements: 2.3, 2.4, 2.9_

  - [ ] 9.3 Build Staff/Admin dashboards wired to management endpoints
    - Inquiry management, pending-receipt review (open signed URLs, approve/reject), donation review, and Admin-only listing/user management; escape all user-supplied text on render; hide controls by role for UX only (security stays on the backend)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 7.3_

  - [ ]* 9.4 Write integration tests for end-to-end API flows
    - Inquiry submission against active/inactive listings; register→upload→approve→MEMBER; donation submit→verify; privileged endpoints return 401/403 without proper context
    - _Requirements: 1.2, 2.5, 3.6, 4.4_

- [ ] 10. Final checkpoint - ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional (tests) and can be skipped for a faster MVP, though the property tests directly validate the design's non-negotiable security invariants.
- Each task references specific granular requirements for traceability.
- Property-based tests cover the seven correctness properties; unit tests cover edge cases and error paths.
- Non-negotiable rules are enforced centrally in `api/_lib/` (requireRole, parameterized queries, private storage + signed URLs, validation/sanitization, file-upload hardening) and reused by every domain service.
- Checkpoints provide incremental validation at tier/domain boundaries.
- Status legend: `[x]` complete, `[-]` in progress, `[ ]` not started. As of this update, the Data layer, shared `api/_lib/` helpers, `requireRole`, the Listings public-read + Admin service logic, and the Inquiry public-submission + Staff/Admin management are implemented; 70 unit/property tests pass (`npm test`).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "1.5"] },
    { "id": 2, "tasks": ["1.6", "2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4", "4.1", "4.2", "5.1", "6.1", "6.2", "8.1"] },
    { "id": 4, "tasks": ["4.3", "4.4", "5.2", "5.4", "6.3", "6.4", "8.2", "8.3", "8.4"] },
    { "id": 5, "tasks": ["4.5", "5.3", "5.5", "6.5", "6.6", "6.7", "6.8", "8.5", "8.6", "9.1", "9.2", "9.3"] },
    { "id": 6, "tasks": ["9.4"] }
  ]
}
```
