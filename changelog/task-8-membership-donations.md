# Task 8 — Implement membership and donations

Status: completed
Requirements: 8.1, 8.2, 8.7, 8.8, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.10, 10.1, 15

## What was built

The membership and donation flows from the design (Flow 2 and Flow 3): the
GCash payment-info endpoints, the authenticated membership receipt upload, and
the public donation submission — plus the two user-facing screens that compose
them. All receipt storage and file validation go through the Task 6 private
storage client (`lib/storage/receipts.ts`); no second validator was written. All
screens compose the Task 6.5 design-system primitives/tokens and implement the
required loading / empty / error / interactive states (Requirement 15).

### 8.1 — Payment-info endpoints (membership + donations)

- `app/api/membership/payment-info/route.ts` and
  `app/api/donations/payment-info/route.ts` — GET handlers returning the GCash
  QR info (`label`, `accountName`, `qrImageUrl`, `instructions`). Both read the
  editable site config `content/payment.ts` — nothing is hardcoded. These are
  PUBLIC endpoints (Requirement 6.5) and build as static routes. _Satisfies
  8.1, 9.1._

### 8.2 — Membership receipt upload (authenticated) + `getMyMembership`

- `lib/membership.ts`:
  - `submitMembershipReceipt(file)` — requires an authenticated session via
    `assertRole` (absent/invalid → 401), validates the file with the shared
    `validateReceiptFile` (bad type/size → 400, Requirement 8.8), uploads via
    `uploadReceipt` (stores privately, returns ONLY the `file_key`, Requirement
    10.1), then inserts a `membership_receipts` row with status `PENDING` owned
    by the caller through the role-aware client so RLS applies (Requirement
    8.2).
  - `getMyMembership()` — reads the caller's own `profiles.membership_status`
    (Requirement 8.7).
- `app/api/membership/receipt/route.ts` — POST handler parsing multipart form
  data and mapping the domain result to 201 / 400 / 401 / 500.
- `app/api/membership/me/route.ts` — GET handler for the current status
  (200 / 401 / 500); marked `dynamic = "force-dynamic"` because it resolves the
  session from request cookies and must not be prerendered.
- `app/membership/page.tsx` + `app/membership/MembershipForm.tsx` — the
  membership screen: the payment panel beside the authenticated upload form,
  with loading (status spinner), member/unauthenticated guidance, inline
  error + recovery, and a PENDING success confirmation. _Satisfies 8.2, 8.7,
  8.8, 10.1._

### 8.3 — Donation submission (public)

- `lib/donations.ts` — `submitDonation(input)`:
  - rejects `amount <= 0` (and blank/non-numeric) with 400 BEFORE any upload
    (Requirements 9.2, 9.3);
  - requires a receipt file and validates it with the shared
    `validateReceiptFile` (bad/missing → 400, Requirement 9.10);
  - normalizes donor name/email independently: both omitted → anonymous
    (null/null, Requirement 9.5); exactly one provided → keep it, null the
    other, non-anonymous (Requirement 9.6);
  - stores the receipt privately and inserts a `donations` row with status
    `PENDING`, persisting only the `file_key` (Requirements 9.4, 10.1).
- `app/api/donations/route.ts` — PUBLIC POST handler (no `assertRole`), parsing
  multipart form data and mapping to 201 / 400 / 500.
- `app/donate/page.tsx` + `app/donate/DonationForm.tsx` — the public donation
  screen: payment panel beside the form with field-level amount validation
  (mirrors the server rule), optional donor fields with anonymous guidance,
  in-flight/disabled submit, inline error recovery, and a PENDING success
  confirmation. _Satisfies 9.1–9.6, 9.10, 10.1._

### Shared UI

- `app/_components/PaymentInfoPanel.tsx` — client component shared by both
  screens that fetches a payment-info endpoint and renders the QR + details,
  with the required loading (skeletons) and error (message + retry) states. The
  QR path comes from the endpoint (i.e. `content/payment.ts`), never hardcoded.
- `app/globals.css` — added token-driven layout utilities (`stack-3`,
  `stack-5`, `two-col`, `.payment-qr`) used by the new screens. Every value
  references a design token; no raw colors/px were introduced.

## Design details honored

- **Receipts stay PRIVATE** (Requirement 10.1; Correctness Property 3): both
  upload paths call `uploadReceipt`, which returns only the private `file_key`;
  no public URL is persisted or returned. Signed-URL viewing is a Staff/Admin
  dashboard concern (Task 9.2/9.3), out of scope here.
- **Single file validator reused** — both membership and donation uploads use
  `validateReceiptFile` from Task 6; no second allow-list/size cap was written.
- **RLS remains authoritative** — all inserts/reads run through the role-aware
  server client. Membership upload is guarded by `assertRole` for a 401 UX;
  donation submission is PUBLIC and relies on the anon-insert RLS policy plus
  the `amount > 0` CHECK, with the app-layer 400 checks for fast feedback.
- **Generic errors** (Requirement 14.6) — client-facing failures return generic
  messages; diagnostics stay server-side.
- **HTTP status conventions** — 201 on create, 400 for amount<=0 / bad file,
  401 for unauthenticated membership upload, 500 for upstream failures.

## Requirement 15 coverage

- 15.1 no hardcoded design values — screens compose primitives + token classes;
  grep for `style={{`, hex colors, and `px` across the new `app/**/*.tsx`
  returns only token-referencing Skeleton size props.
- 15.4/15.5 primitives + interactive states — Button/Field/Card/Feedback/
  StatusBadge; submit buttons disable while in flight.
- 15.6 loading — status spinner (membership) + skeleton QR (payment panel).
- 15.7 empty/guidance — unauthenticated and already-member panels guide the
  user rather than showing blank space.
- 15.8 error — field-level amount validation + inline Feedback with the form as
  the recovery path; payment-panel retry.
- 15.9 mobile-first — `two-col` collapses to one column on small screens.
- 15.10 no banned tropes — content-sized cards, no mesh gradients / glass blobs
  / badge-pill hero / uniform 3-col grid.

## Scope boundaries (deliberate)

- Staff/Admin review (approve/reject receipts, verify/reject donations, signed
  view URLs, 409 on non-PENDING) is Task 9.2/9.3 — not here.
- No nav links were added to `SiteNav` to avoid overlapping Task 7's public-page
  refactor and reduce merge-conflict risk; the pages are reachable by route
  (`/membership`, `/donate`).
- No bucket provisioning — the private `receipts` bucket is a student step in
  Task 13.1 (Session 2).

## Files

- app/api/membership/payment-info/route.ts (new) — 8.1 membership payment info.
- app/api/donations/payment-info/route.ts (new) — 8.1 donation payment info.
- app/api/membership/receipt/route.ts (new) — 8.2 receipt upload handler.
- app/api/membership/me/route.ts (new) — 8.2 `getMyMembership` handler.
- app/api/donations/route.ts (new) — 8.3 public donation handler.
- lib/membership.ts (new) — `submitMembershipReceipt`, `getMyMembership`.
- lib/donations.ts (new) — `submitDonation` (amount/file/donor rules).
- app/membership/page.tsx, app/membership/MembershipForm.tsx (new) — membership
  screen.
- app/donate/page.tsx, app/donate/DonationForm.tsx (new) — donation screen.
- app/_components/PaymentInfoPanel.tsx (new) — shared payment-info panel.
- app/globals.css (edited) — token-driven layout utilities for the new screens.
- .kiro/specs/pos-catalog-site-core/tasks.md — marked Task 8 and 8.1–8.3 done.

## Verification

Type-check and production build, run once, both clean:

- `npx tsc --noEmit` — exit 0, no type errors.
- `npm run build` (`next build`) — compiled successfully; lint + type
  validation passed; 12 pages generated. The payment-info routes build static;
  `/api/membership/me`, `/api/membership/receipt`, and `/api/donations` are
  server-rendered on demand (dynamic), and `/membership` + `/donate` build
  cleanly.

There is no live Supabase/Storage in this environment, so uploads, signed URLs,
and persistence could NOT be exercised at runtime. Behavior was verified by
types/build and **static review against Requirements 8, 9, 10, and 15**:
receipt storage goes through `lib/storage/receipts.ts` (private `file_key`
only); the single `validateReceiptFile` allow-list + size cap is reused; a
non-positive donation amount is rejected with 400 before any upload; donor
name/email normalize to the anonymous (null/null) and one-field cases; and the
required loading/empty/error/interactive states exist on both screens with no
inline/hardcoded design values. Live verification is deferred to student
provisioning (Session 2; the private `receipts` bucket is created in Task 13.1).
