# Structure

## Current state

The repository currently contains only Kiro specs — no application code has been scaffolded yet. The authoritative spec is `pos-catalog-site-core`, which reconciles the lean Next.js + RLS core (Version A) with the fuller membership/donations/receipt-review scope (Version B).

```
.kiro/
├── specs/
│   └── pos-catalog-site-core/        # authoritative reconciled spec
│       ├── requirements.md
│       ├── design.md
│       └── tasks.md
└── steering/                         # project guidance (this folder)
    ├── product.md
    ├── tech.md
    └── structure.md
```

A separate timestamped backup folder (`specs-...`) holds the earlier `it-consulting-website` (Version B) spec for reference only. Treat `pos-catalog-site-core` as the source of truth and keep implementation aligned with it.

## Intended application layout

The app is a **single Next.js (App Router) application** deployed to Vercel, with Supabase for Postgres (+ RLS), Auth, and Storage. Organize by tier/role so the three-tier separation stays visible, while keeping everything in one app:

```
/                           # repo root — single Next.js app (deployed to Vercel)
├── app/                    # App Router (Presentation + Application layers)
│   ├── (public)/           # landing, catalog, listing detail, inquiry/donation forms
│   ├── (auth)/             # register / login / logout UI
│   ├── dashboard/          # Admin / Staff / Member dashboards (finished features)
│   └── api/                # Route Handlers (server-side application logic)
│       ├── inquiries/      # public inquiry submission + staff triage
│       ├── membership/     # payment info, receipt upload, verification
│       ├── donations/      # donation submission + verification
│       └── admin/          # listing management, role assignment
├── lib/                    # shared server/client helpers
│   ├── supabase/           # browser, role-aware server, and service-role clients
│   ├── auth.ts             # getRoleFromSession, assertRole (401/403; UX layer)
│   ├── storage.ts          # private upload + signed-URL minting
│   └── validation.ts       # input validation, sanitization, file-upload hardening
├── content/                # editable, student-customized surfaces (see Canonical files)
│   ├── site.ts             # site name, headline, intro, branding
│   ├── listings.ts         # catalog listings data (title/description/category/inquiry_type/image_url)
│   └── payment.ts          # GCash payment label/config
├── public/
│   └── images/             # pre-committed listing images (student-customized)
│       └── gcash-qr.png    # the GCash QR asset students drop in
├── db/                     # SQL applied to each student's own Supabase project
│   ├── setup.sql           # schema + RLS policies + transactional approval function (idempotent)
│   ├── seed.sql            # sample published/unpublished listings
│   └── seed-roles.sql      # steps/SQL to set a student's own Admin/Staff/User roles
├── .env.example            # documents the three env vars + exposure scope (students copy to .env.local)
└── package.json
```

> `.env.local` (student-created from `.env.example`) holds the real keys and is gitignored; it never gets committed.

## Organizing conventions

- **One app, tiers by responsibility.** Presentation (client components/pages) and Application (route handlers / server components) both live under `app/`, but the application layer never leaks presentation concerns, and the frontend never reaches the database directly — it only calls route handlers/server actions.
- **RLS is the authoritative boundary.** Application-layer `assertRole` provides 401/403 and hides controls; the final access decision is made by PostgreSQL RLS in `db/`.
- **Shared helpers in `lib/`.** Supabase clients, `assertRole`, signed-URL minting, and validation are defined once and reused.
- **Database definitions in `db/`.** Schema, RLS policies, the transactional approval function, and seed data live here and are applied via Supabase — not scattered through app code.
- **Student-customizable surfaces are isolated.** The only files students edit are `content/site.ts`, `content/listings.ts`, `content/payment.ts`, and assets under `public/images/` (including `public/images/gcash-qr.png`). Backend logic in `app/api/` and `lib/` is pre-built and not edited.
- **Domain modules** map to the design's components: Listings, Inquiry, Membership, Donation, and Auth/role resolution.

## Canonical files (single source of truth)

These exact paths are locked so the repo, the SQL scripts, and the student-facing workshop docs all agree. Do not rename without updating `docs/workshop/`:

| Purpose | Canonical path | Who touches it |
|---------|----------------|----------------|
| Site text / branding | `content/site.ts` | Student (Session 1) |
| Catalog listings data | `content/listings.ts` | Student (Session 1) |
| GCash payment label/config | `content/payment.ts` | Student (Session 2) |
| Listing images | `public/images/*` | Student (Session 1) |
| GCash QR asset | `public/images/gcash-qr.png` | Student (Session 2) |
| DB schema + RLS + approval function | `db/setup.sql` | Student runs in own Supabase (Session 2) |
| Seed listings | `db/seed.sql` | Student runs in own Supabase (Session 2) |
| Role-seeding steps/SQL | `db/seed-roles.sql` | Student runs in own Supabase (Session 3) |
| Env template | `.env.example` | Repo ships it; student copies to `.env.local` |
| Local env (real keys, gitignored) | `.env.local` | Student (Session 2) |
| Private storage bucket name | `receipts` | Student creates in own Supabase (Session 2) |
| Env var names | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Student sets (Session 2) |

The student-facing guides in `docs/workshop/` reference these names verbatim; keep them in sync.

## Core data models

Defined in the design; mirror these when writing schema and types:

- **Profile/User** — id (== auth.users.id), email (unique), role {ADMIN, STAFF, USER}, membership_status {MEMBER, NON_MEMBER}.
- **Listing** — id, title, category, description, inquiry_type {DEMO, QUOTE, INQUIRE}, image_url (site-relative under `/images/`), is_published.
- **Inquiry** — id, listing_id (FK), owner_id (nullable FK, anonymous allowed), customer fields, status {NEW, IN_PROGRESS, CLOSED}, handled_by (nullable FK).
- **MembershipReceipt** — id, user_id (FK), file_key (private), status {PENDING, APPROVED, REJECTED}, reviewed_by.
- **Donation** — id, optional donor fields (anonymous allowed), amount (> 0), file_key (private), status {PENDING, VERIFIED, REJECTED}, reviewed_by.

## Naming

- Feature/spec directories use kebab-case (e.g., `pos-catalog-site-core`).
- Database columns and enums follow the names in the design (`membership_status`, `file_key`, `is_published`, `inquiry_type`, etc.) — keep them consistent across schema, RLS, API, and frontend.

## Workshop task grouping

The `tasks.md` is split into **Part A — Build tasks** (instructor/repo author: scaffold, schema, RLS, server logic, dashboards, and ship the provisioning SQL + seed scripts + setup checklist) and **Part B — Workshop tasks** (student, grouped into Session 1/2/3, assemble-and-customize). Each student forks the repo and provisions their **own** Supabase + Vercel projects, applies the provided SQL to their own project, pastes their own keys, and operates finished features; they do not write backend code or tests. There is no shared backend — account sign-ups are a prerequisite before Session 1.
