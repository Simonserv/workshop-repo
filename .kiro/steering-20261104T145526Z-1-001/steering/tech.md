# Tech

## Architecture

Classic three-tier architecture, delivered as a **single Next.js (App Router, TypeScript) application** plus Supabase. Each tier has one clear responsibility. The authoritative access boundary is **PostgreSQL Row Level Security (RLS)** — not the application layer.

| Tier | Responsibility | Must NOT do |
|------|----------------|-------------|
| **Presentation** (Next.js client UI) | Render UI, collect input, call route handlers/server actions, show results. Hide UI by role for UX only. | Trust itself for security; talk to the database directly. |
| **Application** (Next.js Server Components + Route Handlers) | Validate input, resolve role from the verified session, return 401/403, run business rules, call the role-aware Supabase client. | Presentation/DOM logic. Be the final security boundary — RLS is. |
| **Data** (Supabase) | Persist/retrieve data durably; store files privately; **enforce access via RLS**. | — |

**Key teaching point:** the browser is untrusted, and so is the application layer by itself. App-layer `assertRole` gives friendly 401/403 responses and hides controls, but the final guarantee lives in the database via RLS.

## Stack (finalized — one framework, one platform)

| Layer | Technology |
|-------|------------|
| Frontend + App layer | Next.js (App Router, TypeScript) — Server Components, Route Handlers, Server Actions |
| Hosting | Vercel (frontend + server runtime from one GitHub repo) |
| Database | PostgreSQL via Supabase, with **Row Level Security** as the authoritative boundary |
| File storage | Supabase Storage (private bucket + signed URLs) |
| Authentication | Supabase Auth (JWT in session cookie); role stored in `profiles` |

Supabase provides database, auth, and storage on one platform (one account, one SDK, one set of credentials). A single Next.js app on Vercel serves both UI and server logic, so students hold one mental model and one repo. PostgreSQL is used because the data is highly relational (users↔receipts, listings↔inquiries), dashboards rely on JOINs/FKs/constraints, and — crucially — **RLS is a Postgres feature**, which is what makes the data layer the authoritative security boundary.

### Reconciliation note

This reconciles two earlier specs: the lean Next.js + RLS core (Version A) and the fuller membership/donations/receipt-review scope (Version B). We keep **A's single Next.js app** (no hand-wired serverless tier split) and **A's RLS-as-authoritative model**, and fold in **B's features** (membership receipts, donations, Staff/Admin verification). B's domain "services" (Listings, Inquiry, Membership, Donation, Auth) survive as server-side modules inside the one app, not as separate deployable functions.

## Workshop delivery model (assemble-and-customize)

- **Each student owns their own stack.** Every student forks the repo into their own GitHub account, creates their own Supabase project, creates their own Vercel project, and controls their own `.env`. There is no shared backend.
- **Provision by running provided scripts.** The repo ships ready-to-run SQL (schema + RLS + approval function + seed) and a setup checklist; students apply the SQL to their own Supabase project and create their own private receipts bucket — they don't author the SQL.
- **Customize by editing files.** Catalog content, membership copy, and branding are customized by editing data/config files and dropping assets into `public/`.
- **Paste their own keys.** Students set their own Supabase URL + anon key (public) and server-only service-role key in their own `.env` and Vercel project.
- **Operate finished features.** Receipt upload and receipt/donation review are used via finished UI, not implemented by students.
- **Prerequisite before Session 1.** Account sign-ups (GitHub/Supabase/Vercel) and tool installs (Node + editor) are completed beforehand so class time is spent applying scripts and customizing.

## Non-negotiable rules

- **RLS is the authoritative boundary.** Policies resolve the role from `profiles` via `auth.uid()`, never from client input. Application `assertRole` provides 401/403 and hides controls, but the DB decides access.
- **Role resolution.** Verify the session (signature + expiry), then read the role from the persisted `profiles` record — never from a client-supplied value or token payload alone.
- **Private receipts only.** Receipt files (membership + donation) go in a private bucket. The DB stores only a `file_key`, never a public URL. Access is via short-lived signed URLs (~300s TTL) issued only to Staff/Admin after a role check.
- **Parameterized access only.** Use the Supabase query builder / parameterized SQL; never string-concatenate SQL.
- **Input validation & sanitization.** Validate all inputs; sanitize/escape any user text rendered in dashboards (XSS defense).
- **File upload hardening.** Enforce a content-type allow-list (image/* and application/pdf) and size caps.
- **Passwords.** Handled by Supabase Auth; never stored or handled in plaintext.
- **Secrets (student-owned).** Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are exposed to the browser. `SUPABASE_SERVICE_ROLE_KEY` is server-only (used for the few privileged admin writes like role assignment) and never shipped to the client or committed to the repo. Each student manages their own values in their own `.env` and Vercel project settings.
- **Safe errors.** Client errors are generic (no stack traces, secrets, or internals). Detailed diagnostics are logged server-side only.

## HTTP status conventions

- `201` — resource created (inquiry, donation, receipt, registration).
- `400` — invalid/missing input, inactive/nonexistent listing, bad file type/size, donation amount ≤ 0.
- `401` — missing/invalid/expired session on a privileged endpoint.
- `403` — valid session, insufficient role.
- `409` — attempting to review (approve/reject/verify) a record whose status is not PENDING (reviews are terminal and single).
- `500` — upstream storage/DB failure (generic message only).

## Key invariants (good test candidates — instructor-maintained)

- Membership is set to MEMBER **only** by approving a membership receipt (transactional: receipt→APPROVED and user→MEMBER atomically).
- Donations persist only when `amount > 0`.
- Inquiries persist only when `listing_id` references a listing published/active at submission time.
- Once a receipt/donation is reviewed, further review attempts return 409.
- The authorization role is read from `profiles`, and RLS denies forbidden rows even if the app-layer check is bypassed.

## Common commands

No build tooling is committed yet (the repo currently holds specs only). As the Next.js app is implemented, typical commands will be:

```bash
# Next.js app (Vercel)
npm install              # install dependencies
npm run dev              # run the Next.js app locally
npm run build            # production build
vercel                   # deploy a preview
vercel --prod            # deploy to production

# Database (Supabase)
# Apply schema + RLS + the approval function via the Supabase SQL editor or CLI:
supabase db push         # apply migrations (if using Supabase CLI)
```

Deployment is Git-driven: pushing to `main` on the connected GitHub repo auto-deploys the Next.js app to Vercel over HTTPS. Confirm actual scripts against `package.json` once it exists before relying on them.

## Performance notes (workshop scale)

- Serverless/edge cold starts add a short first-request delay; acceptable here.
- Add DB indexes on frequent filters: `inquiries.status`, `membership_receipts.status`, `donations.status`, `listings.is_published`.
- Signed URL TTL ~300s balances security and usability.
