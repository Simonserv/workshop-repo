# Task 7 — Implement public pages and flows

Status: completed
Requirements: 1.1, 1.2, 1.3, 1.4 (7.1); 2.1, 2.2, 2.3, 2.4, 2.5 (7.2);
3.1, 3.2, 3.3, 3.4, 3.5 (7.3); 4.1, 4.2, 4.3, 4.4, 4.5, 4.6 (7.4); 15 (all)

## What was built

The public experience end to end — landing → catalog → listing detail →
inquiry submission — composed from the Task 6.5 design system (tokens +
primitives) with the required loading, empty, error, and interactive states on
every data-driven screen (Requirement 15). Catalog and detail reads go through
the ROLE-AWARE server client so **Row Level Security** is the authoritative
visibility boundary; the application layer never filters by role as a security
mechanism.

### 7.1 Landing page (Requirements 1.1–1.4)

`app/page.tsx` renders the hero entirely from the editable `content/site.ts`
(name, headline, tagline, intro, CTA label — Requirement 1.4), requires no
authentication, and is a plain Server Component with no session branching, so
it is identical for anonymous and authenticated visitors (Requirements 1.1,
1.3). The CTA is the shared `ButtonLink` primitive pointing at `/catalog`, and
`SiteNav` (root layout) gives the persistent landing ↔ catalog ↔ auth path
(Requirement 1.2). This page already met the requirement after the Task 6.5
refactor and was confirmed, not rebuilt.

### 7.2 Catalog listing (Requirements 2.1–2.5)

- `lib/listings.ts` (new, server-only) — the design's **Listings** component.
  `getVisibleListings()` selects from the `listings` table via
  `createServerSupabaseClient` (the role-aware client), so RLS returns published
  rows for anon/USER and all rows for STAFF/ADMIN (Requirements 2.1–2.3, 2.5).
  The app issues the same query for every caller; the database decides
  visibility. Uses the Supabase query builder (parameterized), never
  string-built SQL (Requirement 14.5).
- `app/catalog/page.tsx` (rewritten) — awaits `getVisibleListings()` and renders
  each listing's title and its `/images/` image in content-sized `Card`
  primitives that link to `/catalog/{id}` (Requirement 2.4). Marked
  `dynamic = "force-dynamic"` so the result always reflects the current
  caller's role under RLS rather than a shared cached copy. Unpublished rows
  (only ever returned to Staff/Admin) get an inline "Unpublished" hint (UX only).
- `app/catalog/loading.tsx` (new) — skeleton card grid shown while the Server
  Component awaits data (Requirement 15.6).
- `app/catalog/error.tsx` (new) — error state with a `reset()` retry if the
  RLS-scoped read throws (Requirement 15.8).
- Empty state: an `EmptyState` renders when no visible listings exist
  (Requirement 15.7) — replacing the Session-1 placeholder that read from the
  static content file.

### 7.3 Listing detail (Requirements 3.1–3.5)

- `lib/listings.ts` `getListingById(id)` — reads one listing by id through the
  role-aware client. RLS governs unpublished visibility: an anon/USER request
  for an unpublished listing returns no row, reported as `null` so the page can
  render a denied/not-found state **without leaking whether the row exists**
  (Requirements 3.1–3.3). Staff/Admin can retrieve unpublished listings. The DB
  has no slug column, so the UUID `id` is the detail-page key.
- `app/catalog/[id]/page.tsx` (new) — renders the title, description, and
  `/images/` image (Requirement 3.4); a `null` listing renders the not-found /
  denied `EmptyState`. Presents the inquiry form that corresponds to the
  listing's `inquiry_type` (Requirement 3.5). `dynamic = "force-dynamic"`.
- `app/catalog/[id]/loading.tsx` and `error.tsx` (new) — the detail loading
  skeleton and error-with-retry (Requirements 15.6, 15.8). A denied/not-found
  listing is handled as an empty state in the page, not as an error.
- `app/_components/InquiryForm.tsx` (new, client) — selects heading, lead,
  details label/hint, and submit label from a per-`inquiry_type` copy map
  (DEMO / QUOTE / INQUIRE), so the form matching the type is presented
  (Requirement 3.5), while the underlying fields and POST target are shared.

### 7.4 Inquiry submission (Requirements 4.1–4.6)

- `lib/validation.ts` (new) — dependency-free shared guards: `isNonEmpty`,
  `isValidEmail` (well-formed email gate), `sanitizeText` (trims and strips
  `<`/`>` so stored free-text is inert against dashboard XSS, Requirements 4.6,
  12.6), and `normalizeString`.
- `app/api/inquiries/route.ts` (new) — the public `POST /api/inquiries` route
  handler implementing the design's `submitInquiry` algorithm and Flow 1:
  1. Validate non-empty name, well-formed email, non-empty details → on failure
     respond **400 with field-level errors and persist nothing** (Requirements
     4.2, 4.5).
  2. Look up the `listing_id` via the role-aware client; a missing / unpublished
     / invalid listing is a **400** (Requirements 4.3, 4.4; Correctness
     Property 4). Because the lookup is RLS-scoped, an unpublished listing is
     invisible to an anon/USER submitter and is correctly rejected.
  3. Associate `owner_id` from the verified session when authenticated, else
     null (Requirement 4.1); sanitize name/phone/details and insert with
     `status = NEW`, returning **201** with the inquiry id (Requirement 4.2).
  Accepts submissions with no authentication (Requirements 4.1, 6.5). Upstream
  DB failures return a generic 500 with no internal diagnostics (Requirement
  14.6).
- `InquiryForm` wiring — posts to the route handler and renders the full state
  set (Requirement 15): disabled + relabelled submit while submitting
  (interactive), field-level errors mapped back onto the matching `Field` plus a
  non-field `Feedback` recovery message (error, 15.8), and a success `Feedback`
  surfacing the returned inquiry id (4.2). The route handler remains the
  authoritative validator; the client wiring is UX only.

## Design / security details honored

- **RLS is the authoritative boundary.** Catalog and detail reads and the
  inquiry listing lookup all use `createServerSupabaseClient` (role-aware, anon
  key, session JWT forwarded), never the service-role client; no app-layer role
  filter stands in for RLS (tech.md non-negotiables; Requirements 2.5, 3.3).
- **HTTP status conventions** (tech.md): 201 on create, 400 for invalid input /
  inactive-nonexistent listing, 500 generic for upstream failure.
- **Parameterized access only** — Supabase query builder throughout.
- **Input validation + sanitization** before persisting (4.5, 4.6).
- **Requirement 15** — every screen composes tokens/primitives with explicit
  loading, empty, error, and interactive states; no new styling dependency and
  no inline/hardcoded design values were introduced (see Verification).

## Scope boundaries (deliberate)

- Membership/donation payment info and submission are Task 8; Staff/Admin
  triage/review dashboards are Task 9. The `inquiries` rows created here are
  read and actioned by the Task 9.1 triage dashboard.
- Catalog images remain static `public/images/` files referenced by a
  site-relative `image_url` — not object storage.
- Authentication UI (register/login forms) is Task 5's server actions already in
  place; this task only *associates* an authenticated submitter's `owner_id`.

## Files

- lib/listings.ts (new) — role-aware `getVisibleListings` / `getListingById`.
- lib/validation.ts (new) — shared non-empty / email / sanitize helpers.
- app/api/inquiries/route.ts (new) — public inquiry submission handler.
- app/_components/InquiryForm.tsx (new) — inquiry-type-aware client form.
- app/catalog/page.tsx (rewritten) — RLS-backed catalog grid + empty state.
- app/catalog/loading.tsx, app/catalog/error.tsx (new) — catalog states.
- app/catalog/[id]/page.tsx, loading.tsx, error.tsx (new) — detail + states.
- app/page.tsx (confirmed, unchanged) — landing already meets Requirement 1.
- .kiro/specs/pos-catalog-site-core/tasks.md — marked Task 7 and 7.1–7.4 done.

## Verification

Type-check and production build, run once, both clean:

- `npx tsc --noEmit` — exit 0, no type errors.
- `npm run build` (`next build`) — compiled successfully; lint + type
  validation passed; 7 routes generated. `/catalog` and `/catalog/[id]` build as
  dynamic (ƒ) server-rendered routes (correct for per-role RLS reads) and
  `/api/inquiries` as a dynamic route handler.

Static review against Requirements 1–4 and 15 confirmed: landing renders from
`content/site.ts` with a catalog nav path and no auth; catalog/detail read via
the role-aware client with no app-layer role filter; the inquiry handler returns
400 + field errors (persisting nothing) on invalid input, 400 on an
inactive/nonexistent listing, associates `owner_id` only from the verified
session, sanitizes name/details, and persists `status = NEW` returning 201; and
every screen provides loading, empty, error, and interactive states. A grep for
`style={{`, `borderRadius`, hex colors, and `px"` across the new
`app/catalog/**/*.tsx` and `app/_components/InquiryForm.tsx` returns nothing — no
inline/hardcoded design values were introduced (skeleton size props reference
spacing/radius tokens only).

There is no live Supabase instance here, so the RLS-scoped catalog/detail reads,
`owner_id` association, and inquiry persistence could NOT be exercised end to
end at runtime. Live verification of RLS visibility, authenticated-owner
association, and persistence is deferred to when a student provisions their own
Supabase project and seeds listings (Task 13.1, Session 2).
