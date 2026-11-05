# Implementation Plan: Three-Tier Catalog & Membership Website (Workshop Build)

## Overview

This plan builds a single **Next.js (App Router, TypeScript)** application on **Vercel** with **Supabase** (PostgreSQL + Row Level Security, Auth, private Storage) and reconciles the lean core (Version A) with the full membership/donations/receipt-review scope (Version B).

It serves two audiences, kept deliberately separate:

- **Build tasks (instructor / repo author):** scaffold the app, write the schema + RLS, implement the server logic and dashboards, and ship the provisioning SQL + seed scripts + setup checklist. These produce the ready-to-run code and scripts each student applies to their **own** Supabase project.
- **Workshop tasks (student, assemble-and-customize):** customize data/config files, drop in assets, paste the provided keys, and operate the finished features. Grouped into the three sessions.

RLS is the authoritative access boundary; application-layer `assertRole` provides 401/403 and UX only. Receipts live in a private bucket and are viewed via short-lived signed URLs. Tasks marked `*` are optional (instructor-maintained tests / hardening) and are off the student critical path.

## Tasks

The plan is split into **Part A — Build tasks** (instructor / repo author) and **Part B — Workshop tasks** (student, assemble-and-customize, grouped by session).

---

### Part A — Build tasks (instructor / repo author)

These prepare the ready-to-run repository and the provisioning scripts students will apply to their own projects.

- [x] 1. Scaffold the single Next.js app and base layout
  - Initialize Next.js (App Router, TypeScript) configured for Vercel
  - Create the root layout and shared navigation (landing ↔ catalog ↔ auth)
  - Create `public/images/` and commit placeholder listing images; create the editable content files `content/site.ts`, `content/listings.ts`, and `content/payment.ts` (the only files students customize)
  - Add base styling and a home route placeholder so it runs locally and deploys
  - _Requirements: 1.1, 1.2, 1.4_

- [ ] 2. Configure environment variables and Supabase client factories
  - [x] 2.1 Define the env contract and example file
    - Declare `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as the only public vars
    - Declare `SUPABASE_SERVICE_ROLE_KEY` as server-only (never `NEXT_PUBLIC_`)
    - Add `.env.example` documenting each key and its exposure scope (this is what students paste into)
    - _Requirements: 14.3, 14.4_
  - [ ] 2.2 Implement browser, server, and service-role Supabase clients
    - Browser client (anon key + URL) for client components
    - Role-aware server client that reads the session JWT from cookies (so RLS applies) for Server Components and route handlers
    - Service-role client confined to server-only modules for the few privileged admin writes (role assignment)
    - _Requirements: 6.1, 6.4, 14.4, 14.5_

- [ ] 3. Create the database schema (profiles, listings, inquiries, membership_receipts, donations)
  - `profiles`: id (==auth.users.id), email, `role` constrained to `ADMIN`/`STAFF`/`USER` default `USER`, `membership_status` `MEMBER`/`NON_MEMBER` default `NON_MEMBER`, created_at
  - `listings`: id, title, category enum, description, `inquiry_type` enum (DEMO/QUOTE/INQUIRE), `image_url` (site-relative under `/images/`), `is_published` default false, created_at
  - `inquiries`: id, `listing_id` FK, nullable `owner_id` FK (anonymous allowed), customer fields, `status` NEW/IN_PROGRESS/CLOSED default NEW, nullable `handled_by` FK, created_at
  - `membership_receipts`: id, `user_id` FK, `file_key`, `status` PENDING/APPROVED/REJECTED default PENDING, nullable `reviewed_by` FK, `review_note`, created_at
  - `donations`: id, nullable donor_name/donor_email, `amount` with `CHECK (amount > 0)`, `file_key`, `status` PENDING/VERIFIED/REJECTED default PENDING, nullable `reviewed_by` FK, `review_note`, created_at
  - Trigger/function to insert a `profiles` row (role `USER`, `NON_MEMBER`) on new auth user
  - Indexes on `inquiries.status`, `membership_receipts.status`, `donations.status`, `listings.is_published` plus FK indexes
  - _Requirements: 4.3, 5.1, 5.5, 6.2, 8.2, 9.2, 11.5_

- [ ] 4. Define Row Level Security policies (the authoritative access boundary)
  - [ ] 4.1 SQL helper to resolve the caller's role from `profiles` by `auth.uid()`; used inside all policies so role is never client-supplied
    - _Requirements: 6.1, 6.3, 7.1_
  - [ ] 4.2 Enable RLS + listing policies: read published to anon/USER, read all to STAFF/ADMIN; insert/update/publish restricted to ADMIN
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 3.1, 3.2, 3.3, 7.1, 11.1, 11.2, 11.3_
  - [ ] 4.3 Enable RLS + inquiry policies: anon + authenticated insert; USER reads own, STAFF/ADMIN read all; status/handled_by updates STAFF/ADMIN only
    - _Requirements: 4.1, 4.2, 7.2, 7.3, 7.4, 7.5, 12.1, 12.2_
  - [ ] 4.4 Enable RLS + membership_receipt policies: user inserts own PENDING; USER reads own, STAFF/ADMIN read all; review (status) updates STAFF/ADMIN only
    - _Requirements: 7.2, 7.3, 7.4, 8.2, 8.3, 8.5_
  - [ ] 4.5 Enable RLS + donation policies: anon insert (amount>0 by CHECK); STAFF/ADMIN read all; review updates STAFF/ADMIN only
    - _Requirements: 9.1, 9.2, 9.4, 7.3, 7.4_
  - [ ] 4.6 Enable RLS + profiles policies: member reads own, ADMIN reads all; role change ADMIN-only (service-role client)
    - _Requirements: 7.1, 13.1, 13.2, 13.3_
  - [ ] 4.7 Transactional approval: a Postgres function that sets receipt→APPROVED + user→MEMBER atomically
    - _Requirements: 8.3, 8.4_

- [ ] 5. Implement server-side auth and role helpers
  - `getRoleFromSession` (verify JWT, read `profiles.role`, treat invalid/expired as unauthenticated)
  - `assertRole(allowedRoles)` returning 401 (invalid session) / 403 (insufficient role); export for reuse
  - Register/login/logout via Supabase Auth; default `User`/`NON_MEMBER` enforced server-side via the profiles trigger
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 14.1, 14.2_

- [ ] 6. Implement the private storage client with signed-URL minting
  - `uploadReceipt(file)` → uploads to the private bucket, returns only the `file_key`
  - `createSignedUrl(file_key, ~300s)` → short-lived URL; never persist or return a public URL
  - Shared file validation: content-type allow-list (image/*, application/pdf) + size cap
  - _Requirements: 10.1, 10.2, 8.8, 9.10_

- [ ] 7. Implement public pages and flows
  - [ ] 7.1 Landing page (no auth, same for anon/authenticated), text/branding from the editable content/config file, nav to catalog
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [ ] 7.2 Catalog listing via the role-aware server client (RLS returns published for anon/USER, all for Staff/Admin); render title + `/images/` image; link to detail
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [ ] 7.3 Listing detail via role-aware client (RLS governs unpublished visibility); render title/description/image; present the inquiry form matching `inquiry_type`; handle denied/not-found
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [ ] 7.4 Inquiry submission: route handler validating non-empty name/details + valid email (400 + field errors, persist nothing on failure); reject inactive/nonexistent listing (400); sanitize; persist status NEW; associate owner_id when authenticated; form wired with success/error states
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [ ] 8. Implement membership and donations
  - [ ] 8.1 `payment-info` endpoints returning the GCash QR info from site config (membership + donations)
    - _Requirements: 8.1, 9.1_
  - [ ] 8.2 Membership receipt upload (authenticated): validate file, store privately, persist receipt PENDING; `getMyMembership`
    - _Requirements: 8.2, 8.7, 8.8, 10.1_
  - [ ] 8.3 Donation submission (public): reject amount<=0 (400); validate file; store privately; persist PENDING; handle anonymous vs one-field donor cases
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.10_

- [ ] 9. Implement Staff/Admin dashboards (finished features students will operate)
  - [ ] 9.1 Inquiry triage: list all (status-filtered), update status, set handled_by; guarded by `assertRole(['STAFF','ADMIN'])`; escape rendered text
    - _Requirements: 12.1, 12.2, 12.5, 12.6_
  - [ ] 9.2 Membership receipt review: list PENDING with signed view URLs ordered by created_at; approve (transactional → MEMBER); reject with reason; 409 on non-PENDING; `getReceiptViewUrl` denies non-Staff/Admin
    - _Requirements: 8.3, 8.5, 8.6, 10.2, 10.3, 10.4, 12.3, 12.5_
  - [ ] 9.3 Donation review: status-filtered list; verify (→VERIFIED); reject with reason; 409 on non-PENDING; signed URLs for receipts
    - _Requirements: 9.7, 9.8, 9.9, 12.4, 12.5_
  - [ ] 9.4 Admin listing management: create/edit/publish-unpublish guarded by `assertRole(['ADMIN'])` (403 otherwise); `image_url` as `/images/` path; management UI
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_
  - [ ] 9.5 Admin user management: list members; assign/change role via the server-only service-role client; guarded by `assertRole(['ADMIN'])` (403 otherwise); UI
    - _Requirements: 13.1, 13.2, 13.3, 14.1, 14.4_

- [ ] 10. Ship the provisioning scripts and setup guide (students run these on their OWN project)
  - Provide `db/setup.sql` bundling schema + RLS + the approval function, idempotent so a student can re-run it safely
  - Provide `db/seed.sql` inserting a mix of published/unpublished listings referencing committed `public/images/` files
  - Provide `db/seed-roles.sql` with the steps/SQL to set the student's own Admin/Staff/User roles (via the service-role client)
  - Provide `.env.example` documenting the three env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) and their exposure scope
  - Ensure the private storage bucket name is `receipts` across code and docs
  - The student-facing guides already exist in `docs/workshop/` (Prerequisites + Session 1/2/3 references); keep script names in sync with them
  - _Requirements: 2.1, 2.3, 6.2, 11.5, 13.1, 14.3, 14.4_

- [ ]* 11. Instructor test + hardening pass (optional, off student critical path)
  - Property tests for the seven invariants; unit tests for 401/403, validation, review 409 paths
  - Verify no server-only secret appears in any client bundle; only anon key + URL use `NEXT_PUBLIC_`
  - Confirm unauthorized privileged actions return 403, invalid/expired sessions 401, and RLS denies forbidden rows even if the app check is bypassed
  - _Requirements: all Correctness Properties; 14.1–14.7_

---

### Part B — Workshop tasks (student, assemble-and-customize)

Grouped by session. Each step is "open this file / change these values / save / see it", "run this script on your own project", "paste your own key", or "log in and operate." Students never write backend code, but they provision and own their own GitHub repo, Supabase project, Vercel project, and `.env`. Account sign-ups (GitHub/Supabase/Vercel) and tool installs are a **prerequisite before Session 1**.

- [ ] 12. Session 1 — Build the storefront (Presentation)
  - [ ] 12.1 Fork, run, and deploy your own copy
    - Fork the provided repo into **your own** GitHub account; clone your fork; `npm install`; run locally; connect **your** fork to **your own** Vercel project and deploy to get a live HTTPS URL
    - _Requirements: 1.1_
  - [ ] 12.2 Customize landing text and branding
    - Open the content/config file in VSCode; change the site name, headline, and intro copy; save and refresh
    - _Requirements: 1.4_
  - [ ] 12.3 Customize the catalog
    - Edit the `listings` data/seed entries (title, category, description, `inquiry_type`); drop matching images into `public/images/` and point each `image_url` at them; save and view the catalog and detail pages
    - _Requirements: 2.4, 3.4, 11.5_
  - [ ] 12.4 Session 1 checkpoint
    - Catalog renders your listings/images; each detail page shows the correct inquiry form (DEMO/QUOTE/INQUIRE); the site is live on your Vercel URL

- [ ] 13. Session 2 — Make it real (Application + Data + payment/membership)
  - [ ] 13.1 Provision your own Supabase project
    - Create **your own** Supabase project; run the provided schema + RLS + approval-function SQL; create a **private** receipts bucket; run the seed script to insert listings
    - _Requirements: 2.5, 7.1, 8.3_
  - [ ] 13.2 Connect your app to your backend (your own keys)
    - Copy **your** project's URL + anon key + service-role key; set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY` in `.env` and in **your** Vercel project; redeploy; confirm inquiries now persist
    - _Requirements: 14.3, 14.4_
  - [ ] 13.3 Set up payment display
    - Save your GCash QR as `public/images/gcash-qr.png`; set the payment label in `content/payment.ts`; save and see it on the membership and donation screens
    - _Requirements: 8.1, 9.1_
  - [ ] 13.4 Customize membership copy and try the flows
    - Edit membership benefits/copy text; register a test account, upload a test receipt, and confirm it shows PENDING; submit a test donation and confirm PENDING
    - _Requirements: 8.2, 8.7, 9.4_
  - [ ] 13.5 Session 2 checkpoint
    - Registration/login work; a submitted receipt and donation persist as PENDING against **your own** Supabase backend with private storage
    - _Requirements: 5.2, 8.2, 9.4_

- [ ] 14. Session 3 — Operate the business (Dashboards + go live)
  - [ ] 14.1 Seed your own Admin/Staff/User accounts
    - Using the provided seed steps, create your own Admin, Staff, and User accounts in **your** Supabase project (roles set via the service-role client) so you can demonstrate every dashboard
    - _Requirements: 6.2, 13.1, 13.2_
  - [ ] 14.2 Operate the review dashboards
    - Log in with **your** Staff/Admin account; triage an inquiry; open a pending receipt via its signed URL and approve it → confirm the user becomes MEMBER; reject one with a reason; verify/reject a donation
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 8.3, 8.5, 9.7, 9.8_
  - [ ] 14.3 Manage listings and roles (Admin)
    - Create/edit a listing and toggle publish; assign a role to a member and observe the change
    - _Requirements: 11.1, 11.2, 11.3, 13.1, 13.2_
  - [ ] 14.4 See the security story
    - Try a privileged action without the right role (observe 403); see that RLS denies the underlying row even if a control is bypassed
    - _Requirements: 14.1, 7_
  - [ ] 14.5 Final deploy and showcase
    - Push final changes to **your** repo; confirm **your** Vercel auto-deploy; visit classmates' live URLs
    - _Requirements: 1.1_

---

## Notes

- **Reconciliation:** single Next.js app (from Version A) carries Version B's full scope (membership, donations, receipt review). No separate serverless tier split.
- **RLS is authoritative;** application `assertRole` provides 401/403 and UX only.
- **Each student owns their own stack:** their own GitHub fork, Supabase project, Vercel project, and `.env`. There is no shared backend. The repo author ships provisioning scripts + a setup checklist (Part A task 10); students apply them to their own project (Part B task 13.1). Account sign-ups are a prerequisite before Session 1 to protect the 12:30–4:00 × 3-day timeframe.
- **Images** are pre-committed static files under `public/images/`; `image_url` is a site-relative path. No runtime object storage for catalog images (only receipts use private Storage).
- **Tests** (`*`) are instructor-maintained and optional; students do not write tests.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2.1"] },
    { "id": 1, "tasks": ["2.2", "3"] },
    { "id": 2, "tasks": ["4.1"] },
    { "id": 3, "tasks": ["4.2", "4.3", "4.4", "4.5", "4.6", "4.7"] },
    { "id": 4, "tasks": ["5", "6"] },
    { "id": 5, "tasks": ["7.1", "7.2", "7.3", "7.4", "8.1", "8.2", "8.3"] },
    { "id": 6, "tasks": ["9.1", "9.2", "9.3", "9.4", "9.5"] },
    { "id": 7, "tasks": ["10"] },
    { "id": 8, "tasks": ["11"] },
    { "id": 9, "tasks": ["12"] },
    { "id": 10, "tasks": ["13"] },
    { "id": 11, "tasks": ["14"] }
  ]
}
```

Note: waves 0–8 are Part A (build order; the repo + provisioning scripts in task 10 must exist before the workshop). Waves 9–11 are Part B student sessions and run on three separate days; each student provisions their own backend during Session 2 (task 13.1).
