# POS Catalog Site - Core (Workshop Build)

A single **Next.js App Router + TypeScript** application deployed on **Vercel**, with **Supabase** as its backend.

The project includes a public landing page, a database-backed catalog, listing details, and an inquiry submission form.

## The only files you customize

| File | What it controls |
|---|---|
| `content/site.ts` | Site name, headline, intro, and branding copy |
| `content/listings.ts` | Local catalog fallback data |
| `content/payment.ts` | GCash QR payment label and configuration |

Listing images live in `public/images/` and are referenced using site-relative paths under `/images/`.

## Technology

- Next.js 14 (App Router)
- TypeScript
- Supabase Database
- Supabase Storage
- Vercel

## Run locally

Install dependencies:

```bash
npm install
```

Create your local environment file:

```bash
cp .env.example .env.local
```

On Windows PowerShell, you can use:

```powershell
Copy-Item .env.example .env.local
```

## Supabase configuration

### 1. Create a Supabase project

Create a project at [https://supabase.com](https://supabase.com).

### 2. Configure environment variables

Open your Supabase project and go to **Project Settings → API**.

Add the following variables to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Keep the service role key private. Never expose it in client-side code or commit `.env.local` to GitHub.

### 3. Set up the database

Open **Supabase → SQL Editor**.

Run the SQL scripts in this order:

1. `db/setup.sql` - Creates the database tables, relationships, functions, and Row Level Security policies.
2. `db/seed.sql` - Inserts the initial catalog listings.

### 4. Configure receipt storage

In **Supabase → Storage**:

1. Create a bucket named `receipts`.
2. Keep the bucket private.
3. Set the file size limit to 10 MB.
4. Apply the receipt storage policies through the SQL Editor.

The storage policies allow receipt uploads and restrict receipt reading to authorized Staff and Admin users.

## Run the application

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Current database integration

The following features have been implemented and tested:

- Supabase database connection.
- Catalog listings fetched from Supabase.
- Public catalog displays published listings only.
- Listing detail pages fetched using their database IDs.
- Inquiry form submits data to the API.
- Inquiry records are successfully saved to the Supabase `inquiries` table.
- Row Level Security is enabled for the database tables.

When Supabase environment variables are not configured, the catalog can use the local content data as a fallback.

## Remaining integration work

The following features still need testing:

- Membership receipt uploads.
- Donation receipt uploads.
- User registration and authentication.
- Profile creation and role-based access.
- Membership and donation submissions.
- Staff and Admin dashboard operations.
- Receipt approval and rejection workflows.

## Routes

| Route | Description |
|---|---|
| `/` | Landing page |
| `/catalog` | Public catalog |
| `/catalog/[id]` | Listing details and inquiry form |
| `/login` | Authentication page |
| `/api/inquiries` | Inquiry submission API |

## Build

Run a production build:

```bash
npm run build
```

## Deploy to Vercel

1. Connect the GitHub repository to Vercel.
2. Add the required Supabase environment variables in **Vercel → Settings → Environment Variables**.
3. Deploy the application.

Pushing changes to the connected branch triggers a new deployment.

## Security notes

- Never commit `.env.local`.
- Never expose the Supabase service role key in client-side code.
- Keep the `receipts` bucket private.
- Use Row Level Security to control database access.
