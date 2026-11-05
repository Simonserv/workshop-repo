# POS Catalog Site — Core (Workshop Build)

A single **Next.js (App Router, TypeScript)** application deployed on **Vercel**,
with **Supabase** as the backend (added in later tasks). This commit is the
Session-1 scaffold: landing page, shared navigation, catalog/auth placeholders,
base styling, and the three editable content files.

## The only files you customize

| File | What it controls |
|------|------------------|
| `content/site.ts` | Site name, headline, intro/branding copy (landing page) |
| `content/listings.ts` | Catalog items: title, category, description, inquiry type, image |
| `content/payment.ts` | GCash QR payment label/config |

Listing images live in `public/images/` and are referenced by a site-relative
`image_url` under `/images/`.

## Run locally

```bash
npm install
npm run dev     # http://localhost:3000
```

## Build

```bash
npm run build
```

## Deploy

Connect the repo to a Vercel project. Pushing to `main` auto-deploys over HTTPS.
Vercel auto-detects Next.js — no extra configuration is required.

## Routes in this scaffold

- `/` — landing page (renders from `content/site.ts`)
- `/catalog` — catalog placeholder (renders from `content/listings.ts`)
- `/login` — auth placeholder (real auth added in a later session)
