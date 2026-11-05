# Product

## What this is

A three-tier IT consulting / product-catalog website, built as a single Next.js app on Vercel + Supabase. It serves a dual purpose: a functioning business site and the teaching artifact for a three-part Computer Science workshop. The workshop uses an **assemble-and-customize** model — ready-to-run code plus provisioning scripts ship to students, who fork the repo, create their **own** Supabase and Vercel projects, run the provided SQL, paste their own keys, drop in assets, and operate finished dashboards rather than writing the backend from scratch. Each student owns their own stack and `.env` (no shared backend). The authoritative spec is `pos-catalog-site-core`.

## Core capabilities

- **Public service listings & inquiries** — Visitors browse active service/product listings and submit per-service inquiries (Demo, Quote, or Inquire) with no account required.
- **Membership** — Users register, upload a GCash payment receipt, and gain MEMBER status through manual Staff/Admin verification (two states only: MEMBER, NON_MEMBER).
- **Donations** — Anyone can donate (optionally anonymous, no account) with a GCash receipt, verified manually.
- **Role-based dashboards** — Admin, Staff, and Member/User dashboards for managing inquiries, receipts, donations, listings, and users.

## Roles

- **Visitor** — unauthenticated; can browse, inquire, and donate.
- **User / Member** — authenticated account holder; a Member is a User with approved membership.
- **Staff** — manages inquiries, verifies receipts and donations.
- **Admin** — all Staff abilities plus managing listings and users.

## Guiding principles

- **Teachable over enterprise.** Favor simplicity: one Next.js app, one database, one file store. Omit anything that adds conceptual weight without proportional learning value.
- **Free and deployable.** Everything stays within free tiers at workshop scale, no credit card, no surprise bills.
- **The browser is untrusted — and so is the app layer by itself.** Security is enforced by PostgreSQL Row Level Security as the authoritative boundary; application-layer role checks give 401/403 and hide UI for UX only.
- **Assemble-and-customize, student-owned.** Students customize files, run the provided provisioning scripts, paste their own keys, and operate finished features — each on their **own** GitHub fork, Supabase project, and Vercel project (no shared backend). They don't write backend code, but they own and control their infrastructure and `.env`.

## Explicit non-goals

- Automated/real payment processing or payment gateway integration (GCash QR + manual verification is the ceiling).
- Multiple membership tiers or recurring subscriptions.
- Enterprise concerns: microservices, multi-region, autoscaling, complex CI/CD.
- Forcing registration to browse or inquire.
- A separate hand-wired serverless tier split (the reconciled design uses one Next.js app).
- Student-written automated test suites (property/unit tests are instructor-maintained and optional).
