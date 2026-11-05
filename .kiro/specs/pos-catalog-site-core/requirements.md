# Requirements Document

## Introduction

This document specifies the requirements for a three-tier IT consulting / product-catalog website ("the Platform"), used as the teaching artifact for a three-part Computer Science workshop. It reconciles two earlier specs: the leaner **Next.js + Supabase RLS core** (Version A) and the **full membership/donations/receipt-review scope** (Version B). The result keeps Version A's single-framework simplicity and file-editing customization model, and folds in Version B's richer, backend-dependent features.

The Platform is a single **Next.js (App Router, TypeScript)** application deployed on **Vercel**, with **Supabase** providing PostgreSQL, Authentication, Storage (private bucket), and Row Level Security (RLS). Everything runs on free or free-tier infrastructure.

The workshop is delivered in an **assemble-and-customize** teaching style: the code ships ready to run, and students assemble the site by customizing data files, pasting configuration keys, dropping in assets, and operating finished dashboards — not by writing the hard backend code from scratch. Work is split across three sessions (three separate days, ~3 usable hours each), and each session ends with something visibly working.

The core public experience lets anonymous visitors browse a landing page and a catalog of published listings, view listing details, and submit per-listing inquiries (demo/quote/inquire) without an account. Users can register, upload a GCash payment receipt, and gain MEMBER status through manual Staff/Admin verification. Anyone can donate (optionally anonymously) with a GCash receipt. Three roles — Admin, Staff, and User — are enforced server-side, with **PostgreSQL Row Level Security as the authoritative access boundary**; application-layer role checks provide 401/403 responses and UX only.

## Workshop Delivery Model (how these requirements are taught)

- **Each student owns their own accounts and infrastructure.** Every student creates their own GitHub repo (fork), their own Supabase project, and their own Vercel project, and controls their own `.env` variables. There is no shared backend — each student provisions and seeds their own, the way the original workshop had students create their own GitHub/AWS/Formspree accounts.
- **Provision by running provided scripts.** The repo ships ready-to-run SQL (schema + RLS policies + the approval function + seed data) and setup steps. Students run the SQL against *their own* Supabase project and create *their own* private storage bucket — they don't author the SQL, they apply it.
- **Customize by editing files.** Catalog content, membership copy, and branding are customized by editing data/config files and dropping assets into `public/`, mirroring the "edit an array, save, see the change" pattern.
- **Paste their own keys, don't derive them.** Students connect by pasting *their own* Supabase URL + anon key (and setting the server-only service-role key) into their `.env` and their Vercel project settings.
- **Operate finished features.** Stateful features (receipt upload, receipt/donation review) are used via finished UI, not implemented by students.
- **Seed their own roles.** Each student seeds their own Admin/Staff/User accounts in their own project so they can demonstrate every dashboard on their own deployment.

## Glossary

- **Platform**: The complete three-tier website — the Next.js frontend and server/route-handler layer plus the Supabase-hosted PostgreSQL database and Storage.
- **RLS (Row Level Security)**: PostgreSQL feature that restricts which table rows a role may read/write. It is the authoritative access-control boundary; application-layer checks are convenience/UX only.
- **Role**: One of exactly three authorization levels: `Admin`, `Staff`, `User`. The effective role is resolved server-side from a verified JWT, never from client-supplied data.
- **Member / Non-Member**: A `User` whose `membership_status` is `MEMBER` or `NON_MEMBER` respectively.
- **Staff**: Role that manages inquiries and verifies membership receipts and donations.
- **Admin**: Role with all Staff abilities plus managing listings and assigning roles.
- **Listing**: A catalog item with title, description, category, an `inquiry_type` (DEMO/QUOTE/INQUIRE), a site-relative `image_url` under `/images/`, and a published state.
- **Published**: The state of a listing visible to anonymous visitors and `User`. Unpublished listings are visible only to `Staff`/`Admin`.
- **Inquiry**: A request submitted against a specific Listing; persisted with status defaulting to `NEW`.
- **Membership Receipt**: An uploaded proof-of-payment file a User submits to request Member status; stored privately.
- **Donation**: A monetary gift with an attached receipt file, optionally anonymous, verified manually.
- **Signed URL**: A short-lived (~300s), server-issued URL granting temporary read access to a private receipt file.
- **Verified JWT**: A Supabase-issued JWT whose signature and expiry are validated server-side before any claim is trusted.
- **Anonymous Visitor**: A client with no valid session (no JWT).

## Requirements

### Requirement 1: Public Landing Page

**User Story:** As an anonymous visitor, I want to view a public landing page, so that I can understand what the Platform offers before browsing.

#### Acceptance Criteria

1. WHEN an anonymous visitor requests the landing page, THE Platform SHALL render the public landing page without requiring authentication.
2. THE Platform SHALL provide a navigation path from the landing page to the public catalog listing.
3. WHEN an authenticated member requests the landing page, THE Platform SHALL render the same public landing page.
4. THE Platform SHALL render the landing page's customizable text and branding from editable content/config files committed in the repository.

### Requirement 2: Public Catalog Listing

**User Story:** As a visitor, I want to browse a catalog of listings, so that I can discover available services/products.

#### Acceptance Criteria

1. WHEN an anonymous visitor requests the catalog listing, THE Platform SHALL return only listings whose state is published.
2. WHILE a member holds the User role, THE Platform SHALL return only published listings in the catalog.
3. WHILE a member holds the Staff role OR the Admin role, THE Platform SHALL return both published and unpublished listings.
4. WHEN the catalog is rendered, THE Platform SHALL display each listing's title and image referenced by its site-relative `image_url` under `/images/`.
5. IF a read request for listings is made, THEN THE Platform SHALL enforce listing visibility by role through PostgreSQL Row Level Security as the authoritative boundary.

### Requirement 3: Listing Detail View and Inquiry Type

**User Story:** As a visitor, I want to view a listing's details and the right inquiry form, so that I can evaluate it and make a request.

#### Acceptance Criteria

1. WHEN an anonymous visitor or a User requests the detail view of a published listing, THE Platform SHALL return that listing's full detail.
2. WHILE a member holds the Staff role OR the Admin role, THE Platform SHALL return the detail view of both published and unpublished listings.
3. IF an anonymous visitor or a User requests the detail of an unpublished listing, THEN THE Platform SHALL deny access through Row Level Security.
4. WHEN a listing detail view is rendered, THE Platform SHALL display the title, description, and image referenced by its `image_url` under `/images/`.
5. WHERE a listing specifies an inquiry type of DEMO, QUOTE, or INQUIRE, THE Platform SHALL present the inquiry form that corresponds to that inquiry type.

### Requirement 4: Inquiry Submission

**User Story:** As a visitor or authenticated user, I want to submit an inquiry for a listing, so that the business can follow up with me.

#### Acceptance Criteria

1. THE Platform SHALL accept inquiry submissions without requiring authentication.
2. WHEN a visitor or authenticated member submits an inquiry with a non-empty customer name, a well-formed email, and non-empty details, THE Platform SHALL persist the inquiry with status `NEW` and return a success response containing the inquiry identifier.
3. WHEN an inquiry is submitted, THE Platform SHALL persist it only if its `listing_id` references a listing that is published/active at submission time.
4. IF an inquiry references an inactive or non-existent listing, THEN THE Platform SHALL reject the inquiry with a 400 response.
5. IF an inquiry is submitted with a missing name, missing details, OR an invalid email, THEN THE Platform SHALL reject it with a 400 response and field-level error messages and SHALL persist no record.
6. WHEN an inquiry is submitted, THE Platform SHALL sanitize the customer name and details before persisting them.

### Requirement 5: Authentication

**User Story:** As a user, I want to register, log in, and log out, so that I can access role-appropriate capabilities.

#### Acceptance Criteria

1. WHEN a visitor submits valid registration details, THE Platform SHALL create a member account through Supabase Auth with role `User` and `membership_status` `NON_MEMBER`.
2. WHEN a member submits valid login credentials, THE Platform SHALL establish an authenticated session through Supabase Auth and issue a JWT.
3. WHEN a member requests logout, THE Platform SHALL terminate the authenticated session.
4. THE Platform SHALL rely on Supabase Auth to hash and store passwords, and SHALL NOT store passwords in plaintext.
5. IF a registration request supplies any role or membership value, THEN THE Platform SHALL ignore the client-supplied value and force-assign `User` / `NON_MEMBER` server-side.
6. IF a visitor attempts to register with an already-registered or malformed email, THEN THE Platform SHALL reject the registration with an error response.

### Requirement 6: Server-Resolved Roles and RBAC

**User Story:** As a security-conscious operator, I want roles resolved server-side from a verified token, so that clients cannot escalate their own privileges.

#### Acceptance Criteria

1. WHEN the Platform makes an authorization decision, THE Platform SHALL resolve the member's role server-side from a verified JWT and the persisted member record, never from a client-supplied value.
2. THE Platform SHALL support exactly three roles: Admin, Staff, and User.
3. IF a request supplies a role value from the client, THEN THE Platform SHALL ignore it and use only the server-resolved role.
4. IF a request presents a JWT whose signature or expiry is invalid, THEN THE Platform SHALL reject the request as unauthenticated.
5. THE Platform SHALL classify catalog read, listing detail read, inquiry submission, donation payment info, and donation submission as public and SHALL accept them without authentication.

### Requirement 7: Role-Based Access via Row Level Security

**User Story:** As a security-conscious operator, I want access enforced by PostgreSQL RLS, so that the data layer is the authoritative boundary regardless of client behavior.

#### Acceptance Criteria

1. THE Platform SHALL enforce listing read access by role through PostgreSQL Row Level Security according to the capability matrix.
2. WHILE a member holds the User role, THE Platform SHALL return through RLS only the inquiries and membership receipts that the member owns.
3. WHILE a member holds the Staff role OR the Admin role, THE Platform SHALL return all inquiries, membership receipts, and donations through RLS.
4. WHERE an inquiry status update, receipt review, or donation review is attempted, THE Platform SHALL permit it through RLS only for members holding the Staff role OR the Admin role.
5. IF an anonymous visitor OR a User attempts to read an inquiry, receipt, or donation they do not own, THEN THE Platform SHALL deny the read through RLS.

### Requirement 8: Membership Registration and Verification

**User Story:** As a User, I want to upload a GCash payment receipt and be verified as a Member, so that I can gain Member status through manual review.

#### Acceptance Criteria

1. WHEN a User requests membership payment information, THE Platform SHALL return the GCash QR payment information configured for the site.
2. WHEN an authenticated User submits a membership receipt file, THE Platform SHALL store the file privately in Supabase Storage (persisting only the private `file_key`) and persist a membership receipt with status `PENDING`.
3. WHEN a Staff or Admin approves a `PENDING` membership receipt, THE Platform SHALL set the receipt status to `APPROVED` and set the owning User's `membership_status` to `MEMBER` within a single atomic transaction.
4. THE Platform SHALL set `membership_status` to `MEMBER` only as a result of approving a membership receipt.
5. WHEN a Staff or Admin rejects a `PENDING` membership receipt, THE Platform SHALL set the receipt status to `REJECTED` and record the reviewing member and the rejection reason.
6. IF a Staff or Admin attempts to approve or reject a membership receipt whose status is not `PENDING`, THEN THE Platform SHALL reject the action with a 409 Conflict response.
7. WHEN a User requests their own membership status, THE Platform SHALL return that User's current `membership_status`.
8. IF an uploaded receipt file has a disallowed content type or exceeds the size limit, THEN THE Platform SHALL reject the upload with a 400 response.

### Requirement 9: Donations

**User Story:** As a donor, I want to donate with a GCash receipt, optionally anonymously and without an account, so that I can support the organization and have the gift verified.

#### Acceptance Criteria

1. THE Platform SHALL accept donation submissions without requiring authentication.
2. WHEN a donor submits a donation, THE Platform SHALL persist it only if the `amount` is greater than zero.
3. IF a donation is submitted with an `amount` less than or equal to zero, THEN THE Platform SHALL reject it with a 400 response.
4. WHEN a donor submits a donation with a valid amount and a receipt file, THE Platform SHALL store the receipt privately (persisting only the `file_key`) and persist the donation with status `PENDING`.
5. WHERE a donation omits both donor name and donor email, THE Platform SHALL persist it with null donor fields as an anonymous donation.
6. WHERE a donation provides exactly one of donor name or donor email, THE Platform SHALL persist the provided field, set the other to null, and treat the donation as non-anonymous.
7. WHEN a Staff or Admin verifies a `PENDING` donation, THE Platform SHALL set the donation status to `VERIFIED` and record the reviewing member.
8. WHEN a Staff or Admin rejects a `PENDING` donation, THE Platform SHALL set the donation status to `REJECTED` and record the reviewing member and the rejection reason.
9. IF a Staff or Admin attempts to verify or reject a donation whose status is not `PENDING`, THEN THE Platform SHALL reject the action with a 409 Conflict response.
10. WHEN a donor submits a receipt file, THE Platform SHALL accept it only if its content type is an allowed image type or application/pdf and its size is within the configured limit.

### Requirement 10: Secure Receipt Storage

**User Story:** As a Staff or Admin reviewer, I want receipt files stored privately and accessed only through short-lived signed URLs, so that receipts are never publicly reachable.

#### Acceptance Criteria

1. WHEN a membership or donation receipt file is stored, THE Platform SHALL store it in a private location and persist only the private file key, never a public URL.
2. WHEN a Staff or Admin requests to view a stored receipt, THE Platform SHALL return a signed URL that grants temporary read access and expires within approximately 300 seconds.
3. THE Platform SHALL make a stored receipt readable only through a signed URL minted for a Staff or Admin context, and SHALL NOT expose any permanent public URL to a receipt.
4. IF a request to view a receipt comes from a context that is not Staff or Admin, THEN THE Platform SHALL deny the request without issuing a signed URL.

### Requirement 11: Admin Listing Management

**User Story:** As an administrator, I want to create, edit, and publish listings, so that I can control the catalog.

#### Acceptance Criteria

1. WHILE a member holds the Admin role, THE Platform SHALL allow creating a listing.
2. WHILE a member holds the Admin role, THE Platform SHALL allow editing an existing listing.
3. WHILE a member holds the Admin role, THE Platform SHALL allow publishing and unpublishing a listing.
4. IF a member who does not hold the Admin role attempts to create, edit, publish, or unpublish a listing, THEN THE Platform SHALL deny the action and return a 403 response.
5. WHEN a listing is created or edited, THE Platform SHALL store its `image_url` as a site-relative path under `/images/` referencing a file in the Next.js `public/` folder.

### Requirement 12: Staff Inquiry Triage and Receipt/Donation Review Dashboards

**User Story:** As a Staff or Admin, I want to view and triage inquiries and review pending receipts and donations, so that I can operate the business.

#### Acceptance Criteria

1. WHILE a member holds the Staff role OR the Admin role, THE Platform SHALL allow viewing all inquiries, filtered by status when requested.
2. WHILE a member holds the Staff role OR the Admin role, THE Platform SHALL allow updating an inquiry status to one of `NEW`, `IN_PROGRESS`, or `CLOSED` and setting the handling member.
3. WHEN a Staff or Admin requests pending membership receipts, THE Platform SHALL return only receipts whose status is `PENDING`, each paired with a signed view URL, ordered by creation time.
4. WHEN an Admin or Staff requests donations with a status filter, THE Platform SHALL return only donations matching the requested status.
5. IF a member who does not hold the Staff or Admin role attempts any inquiry triage, receipt review, or donation review action, THEN THE Platform SHALL deny it and return a 403 response.
6. WHEN user-supplied text is rendered in a dashboard, THE Platform SHALL escape or sanitize that text to prevent cross-site scripting.

### Requirement 13: Admin User-Management Dashboard

**User Story:** As an administrator, I want to view members and assign their roles, so that I can manage who has Staff and Admin capabilities.

#### Acceptance Criteria

1. WHILE a member holds the Admin role, THE Platform SHALL allow viewing the list of members.
2. WHILE a member holds the Admin role, THE Platform SHALL allow assigning or changing a member's role to Admin, Staff, or User.
3. IF a member who does not hold the Admin role attempts to assign or change any member's role, THEN THE Platform SHALL deny the action and return a 403 response.

### Requirement 14: Security and Non-Functional Requirements

**User Story:** As a security-conscious operator, I want strong defaults for authorization, session handling, secrets, and error safety, so that the Platform stays secure on free-tier infrastructure.

#### Acceptance Criteria

1. IF an authenticated member without sufficient role attempts a privileged action, THEN THE Platform SHALL return a 403 response.
2. IF a request presents an invalid or expired session, THEN THE Platform SHALL return a 401 response.
3. THE Platform SHALL expose through `NEXT_PUBLIC_` environment variables only the Supabase anon key and the Supabase URL.
4. THE Platform SHALL keep the Supabase `service_role` key server-side only and SHALL NOT expose it to the browser.
5. THE Platform SHALL execute all database access using parameterized queries or the Supabase query builder, never string-concatenated SQL.
6. IF an upstream storage or database operation fails, THEN THE Platform SHALL respond with a 500 status and a generic message that excludes stack traces, secrets, and internal diagnostics.
7. THE Platform SHALL rely on Supabase defaults to encrypt data at rest (AES-256) and in transit (TLS).

## Correctness Properties (invariants the implementation must uphold)

These restate the design's universal properties and are good candidates for instructor-maintained tests (off the student critical path):

1. **Membership only by approval** — `membership_status = MEMBER` only ever results from approving a membership receipt (receipt→APPROVED and user→MEMBER atomically). _Validates: 8.3, 8.4._
2. **Privileged endpoints always authorize** — any Staff/Admin action without a valid Staff/Admin context returns 401 or 403; public endpoints never require auth. _Validates: 6, 12.5, 14.1, 14.2._
3. **Receipts never publicly reachable** — a receipt `file_key` is viewable only via a Staff/Admin-minted signed URL; no stored field is a permanent public URL. _Validates: 10._
4. **Inquiry integrity** — every persisted inquiry references a listing published/active at submission time. _Validates: 4.3._
5. **Review is terminal and single** — once a receipt/donation is reviewed, further review attempts return 409. _Validates: 8.6, 9.9._
6. **Donation amount validity** — donations persist only when `amount > 0`. _Validates: 9.2._
7. **RBAC trusts the database, not the client** — the authorization role is always read from the persisted member record, and RLS is the authoritative boundary. _Validates: 6.1, 7._

## Out of Scope (non-goals)

- Automated/real payment processing or payment gateway integration (GCash QR + manual verification is the ceiling).
- Multiple membership tiers or recurring subscriptions (only `MEMBER` / `NON_MEMBER`).
- Enterprise concerns: microservices, multi-region, autoscaling, complex CI/CD.
- Forcing registration to browse or inquire.
- A separate hand-wired serverless tier split — the reconciled design uses a single Next.js app (App Router route handlers + Server Components) for the application layer.
- Student-written automated test suites — property/unit tests are instructor-maintained and optional, not part of the student critical path.
