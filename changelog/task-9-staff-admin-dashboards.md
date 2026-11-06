# Task 9 — Implement Staff/Admin dashboards

Status: completed
Requirements: 8.3, 8.5, 8.6, 9.7, 9.8, 9.9, 10.2, 10.3, 10.4, 11.1, 11.2, 11.3,
11.4, 11.5, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 13.1, 13.2, 13.3, 14.1, 14.4, 15

## What was built

The finished Staff/Admin dashboards students operate in Session 3: inquiry
triage, membership-receipt review, donation review, listing management, and
user/role management. Each dashboard is a server-rendered page guarded by
`assertRole` (via a shared `DashboardGuard`) with the interactive table/forms in
client components, backed by server-side domain functions and route handlers.

RLS remains the authoritative boundary throughout: every read/write goes through
the role-aware server client (the one exception — role assignment — uses the
service-role client, but only AFTER the `assertRole(['ADMIN'])` gate). The
app-layer guards exist for friendly 401/403 + UX only. All screens compose the
Task 6.5 primitives/tokens and implement the required loading/empty/error/
interactive states (Requirement 15); record statuses render via `StatusBadge`.

### 9.1 — Inquiry triage (Staff/Admin)

- `lib/inquiries.ts` (new): `listInquiries(statusFilter?)` (newest first, joins
  the listing title, RLS §4.3 exposes rows to Staff/Admin) and `updateInquiry`
  (status change and/or assign-to-self). `handled_by` is set to the VERIFIED
  caller id — never a client-supplied id — so assignment can't be forged. Status
  input is validated against the enum.
- `app/api/admin/inquiries/[id]/route.ts` (new): PATCH → 200/400/401/403/500.
- `app/admin/inquiries/page.tsx` + `InquiryTriage.tsx` (new): status-filter bar
  + table with per-row status select and assign-to-me; empty/error/interactive
  states. User text is sanitized on insert (Task 7.4) and escaped by React on
  render (Requirement 12.6). _Satisfies 12.1, 12.2, 12.5, 12.6._

### 9.2 — Membership receipt review (Staff/Admin)

- `lib/membership.ts` (extended): `listPendingReceipts` (PENDING only, oldest
  first, each row carries a freshly-minted short-lived signed view URL),
  `approveReceipt` (delegates to the transactional `approve_receipt()` RPC — the
  ONLY path that grants MEMBER; maps the function's SQLSTATE codes to 404/409/
  403), `rejectReceipt` (reason required; conditioned on still-PENDING so a
  re-review is 409), and `getReceiptViewUrl` (the design's `getReceiptViewUrl`
  algorithm — Staff/Admin only, 404 without leaking existence).
- Route handlers (new): `app/api/admin/receipts/[id]/approve`, `/reject`,
  `/view-url`.
- `app/admin/receipts/page.tsx` + `ReceiptReview.tsx` (new): pending-receipt
  cards with a "View receipt" link (the signed URL — the only way to view the
  file), approve/reject actions, inline reject-reason form, and the 409
  "already reviewed" message surfaced as the recovery cue.
  _Satisfies 8.3, 8.5, 8.6, 10.2, 10.3, 10.4, 12.3, 12.5._

### 9.3 — Donation review (Staff/Admin)

- `lib/donations.ts` (extended): `listDonations(statusFilter?)` (newest first,
  signed receipt URLs), `verifyDonation` (→ VERIFIED), `rejectDonation`
  (reason required → REJECTED). A shared `reviewDonation` conditions the update
  on still-PENDING, so verifying/rejecting a non-PENDING donation is 409.
- Route handlers (new): `app/api/admin/donations/[id]/verify`, `/reject`.
- `app/admin/donations/page.tsx` + `DonationReview.tsx` (new): status-filter bar
  + donation cards (amount via `Intl.NumberFormat` PHP, donor/anonymous label,
  receipt link), verify/reject for PENDING, terminal-state note otherwise.
  _Satisfies 9.7, 9.8, 9.9, 12.4, 12.5._

### 9.4 — Admin listing management (Admin only)

- `lib/listings.ts` (extended): `createListing`, `updateListing`,
  `setListingPublished`, each `assertRole(['ADMIN'])`-guarded (403 otherwise)
  with RLS §4.2 as the authoritative boundary. Shared `normalizeListingInput`
  validates title/description, the category + inquiry-type enums, and requires a
  site-relative `/images/` image path (Requirement 11.5 — no object storage for
  catalog images).
- Route handlers (new): `app/api/admin/listings` (POST create) and
  `app/api/admin/listings/[id]` (PATCH — a `{is_published}`-only body routes to
  the lighter publish toggle, otherwise a full edit).
- `app/admin/listings/page.tsx` + `ListingManager.tsx` (new): reads ALL listings
  (RLS returns drafts to Admin) for a create form + per-listing edit form +
  publish/unpublish button; the server's field-error message (e.g. a bad
  `/images/` path) surfaces inline. _Satisfies 11.1, 11.2, 11.3, 11.4, 11.5._

### 9.5 — Admin user management (Admin only)

- `lib/admin-users.ts` (new): `listMembers` (role-aware client; RLS §4.6 ADMIN
  reads all) and `assignRole` — the role write runs through the server-only
  SERVICE-ROLE client, but only after the `assertRole(['ADMIN'])` gate, with the
  target role validated against the enum. `lib/supabase/service-role.ts` is
  `server-only`, so the key never reaches the browser bundle.
- Route handler (new): `app/api/admin/users/[id]/role` (PATCH).
- `app/admin/users/page.tsx` + `UserManager.tsx` (new): member table with a
  per-row role select + Apply (enabled only when the role changed).
  _Satisfies 13.1, 13.2, 13.3, 14.1, 14.4._

### Shared dashboard infrastructure

- `app/admin/page.tsx` (new): dashboard hub; links to the three review
  dashboards for Staff/Admin, plus the two management dashboards only for an
  ADMIN session (UX affordance on top of the per-page guard + RLS).
- `app/admin/_components/DashboardGuard.tsx` (new): server-side role gate that
  renders the friendly 401 (sign-in) / 403 (forbidden) UX otherwise.
- `app/admin/_components/StatusFilterBar.tsx` (new): link-based status tabs
  (keeps each filtered list server-rendered through RLS; shareable URLs).
- `app/admin/_components/RejectForm.tsx` (new): shared inline reason form reused
  by receipt + donation rejection.
- `app/_components/SiteNav.tsx` (edited): added a "Dashboards" nav link.
- `app/_components/ui/ui.css` (edited): token-driven dashboard styles (table +
  horizontal scroll wrapper, filter chips, review cards, inline select,
  checkbox row, `.sr-only`). Every value references a design token; no raw
  colors/px introduced.

## Design details honored

- **RLS is authoritative.** All reads/writes use the role-aware server client;
  the app-layer `assertRole` guards give 401/403 + UX only. Role assignment is
  the sole service-role write and is gated behind `assertRole(['ADMIN'])`.
- **Receipts stay private** (Requirement 10; Correctness Property 3). Files are
  viewed only via ~300s signed URLs minted server-side; no public URL is ever
  stored or returned.
- **Membership only by approval** (Correctness Property 1). `approveReceipt`
  delegates to the transactional `approve_receipt()` Postgres function — the
  only path that flips a user to MEMBER, atomically with the receipt.
- **Review is terminal and single** (Correctness Property 5). Approve/reject/
  verify all return 409 on a non-PENDING record (via the RPC's SQLSTATE or a
  still-PENDING-conditioned UPDATE).
- **HTTP status conventions** — 200 ok, 400 bad input, 401 unauthenticated, 403
  wrong role, 404 absent, 409 already reviewed, 500 upstream. Client errors are
  generic; diagnostics stay server-side (Requirement 14.6).
- **Dashboards are dynamic** (`force-dynamic`) so each render reflects the
  current caller's role under RLS rather than a shared cached copy.

## Requirement 15 coverage

- 15.1 no hardcoded design values — pages compose primitives + token CSS classes
  only; dashboard styles added to `ui.css` reference tokens exclusively.
- 15.4/15.5 primitives + interactive states — Button/Field/Card/StatusBadge/
  Feedback plus the new filter chips and table controls; row/action controls
  disable while a request is in flight.
- 15.6 loading — list pages render on the server; route `error.tsx`/`loading.tsx`
  conventions already cover the catalog, and dashboards show inline busy states
  during actions.
- 15.7 empty — every list has a guidance empty state (no inquiries/receipts/
  donations/listings/members).
- 15.8 error — inline `Feedback`/`ErrorState` with the action/form as the
  recovery path; server field errors surfaced (e.g. bad `/images/` path).
- 15.9 mobile-first — tables scroll horizontally in `.table-wrap`; review cards
  and the two-column action layout collapse on small screens.
- 15.10 no banned tropes — content-sized cards, no mesh gradients / glass blobs /
  badge-pill hero / forced uniform 3-col grid.

## Files

New lib:
- lib/inquiries.ts — Staff/Admin inquiry triage (list + update).
- lib/admin-users.ts — Admin member list + role assignment (service-role write).

Extended lib:
- lib/membership.ts — list pending receipts, approve (RPC), reject, view-url.
- lib/donations.ts — list donations, verify, reject.
- lib/listings.ts — create/update/setPublished (Admin) + enum helpers.

New route handlers:
- app/api/admin/inquiries/[id]/route.ts
- app/api/admin/receipts/[id]/approve/route.ts, .../reject, .../view-url
- app/api/admin/donations/[id]/verify/route.ts, .../reject
- app/api/admin/listings/route.ts, app/api/admin/listings/[id]/route.ts
- app/api/admin/users/[id]/role/route.ts

New pages/components:
- app/admin/page.tsx — dashboard hub.
- app/admin/_components/DashboardGuard.tsx, StatusFilterBar.tsx, RejectForm.tsx
- app/admin/inquiries/page.tsx + InquiryTriage.tsx
- app/admin/receipts/page.tsx + ReceiptReview.tsx
- app/admin/donations/page.tsx + DonationReview.tsx
- app/admin/listings/page.tsx + ListingManager.tsx
- app/admin/users/page.tsx + UserManager.tsx

Edited:
- app/_components/SiteNav.tsx — "Dashboards" nav link.
- app/_components/ui/ui.css — token-driven dashboard styles.
- .kiro/specs/pos-catalog-site-core/tasks.md — marked Task 9 and 9.1–9.5 done.

## Verification

Type-check and production build, run once, both clean:

- `npx tsc --noEmit` — exit 0, no type errors (after normalizing Supabase's
  embedded to-one relations, which it types as arrays, to the single object they
  are at runtime for the inquiry→listing and receipt→user joins).
- `npm run build` (`next build`) — compiled successfully; lint + type validation
  passed; 19 pages generated. All five dashboards build as dynamic
  (server-rendered on demand, so RLS applies per request), and all ten new
  `/api/admin/**` route handlers build.
- Client-bundle secret scan — grepping `.next/static/**/*.js` for
  `SUPABASE_SERVICE_ROLE_KEY` / `service_role` / `createServiceRoleSupabaseClient`
  returns no matches: the service-role path and its key never reach the browser.

There is no live Supabase/Storage in this environment, so role-gated reads,
signed-URL viewing, the approval RPC, and 409 re-review paths could NOT be
exercised at runtime. Behavior was verified by types/build and static review
against Requirements 8–14 and 15: every privileged function is `assertRole`-
guarded with RLS as the authoritative boundary; approval goes through the
transactional RPC; rejection/verification are conditioned on still-PENDING (409
otherwise); receipts are viewed only via short-lived signed URLs; role
assignment is the sole service-role write and is server-only. Live verification
is deferred to student provisioning (Session 3; Task 14).
