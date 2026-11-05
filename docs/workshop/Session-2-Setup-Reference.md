# Session 2 Setup Reference: Provision Your Own Backend

Use this during **Session 2** to set up your own Supabase backend and connect it to your site. You'll do this on **your own** Supabase project. There is no shared backend. Follow the steps in order. Each one has a checkbox.

> Prerequisite: you completed the [Prerequisites](./Prerequisites.md) checklist and, in Session 1, forked the repo and deployed it to your own Vercel project.

## What you'll have by the end

- Your own Supabase project with the database tables and security rules applied
- A private storage bucket for payment receipts
- Sample listings seeded, and your own Admin/Staff/User accounts
- Your site connected to your backend so inquiries, membership, and donations persist

---

## ✅ Session 2 Checklist

- [ ] Created your own Supabase project
- [ ] Ran the provided setup SQL (tables + security rules + approval function)
- [ ] Created the private `receipts` storage bucket
- [ ] Ran the seed script (sample listings)
- [ ] Copied your Project URL, anon key, and service-role key
- [ ] Set the three keys in `.env.local` AND in your Vercel project
- [ ] Redeployed and confirmed a test inquiry/receipt/donation persists

---

## Step 1: Create your Supabase project

1. Log in at [https://supabase.com](https://supabase.com) (with GitHub).
2. Click **New project**.
3. Give it a name (e.g. `my-catalog-site`), set a **database password** (save it somewhere safe), and pick the region closest to you.
4. Click **Create new project** and wait ~1–2 minutes for it to finish provisioning.

- [ ] Project is created and the dashboard loads

---

## Step 2: Run the setup SQL

**What this does:** creates your tables (listings, inquiries, members, receipts, donations), turns on Row Level Security (the rules that decide who can see what), and adds the approval function.

1. In your Supabase project, open the **SQL Editor** (left sidebar).
2. Click **New query**.
3. Open the provided file `db/setup.sql` from your cloned repo, copy **all** of it, and paste it into the editor.
4. Click **Run**.
5. You should see a success message with no errors. (The script is safe to re-run if you need to.)

- [ ] SQL ran successfully with no errors

> 🧯 If you see an error, make sure you copied the **entire** file and that this is a fresh project. Ask for help before moving on.

---

## Step 3: Create the private receipts bucket

**What this does:** gives you a private place to store uploaded payment receipts. Private means receipts are never publicly viewable. Only you (as Staff/Admin) can open them, through a short-lived secure link.

1. In Supabase, open **Storage** (left sidebar).
2. Click **New bucket**.
3. Name it exactly `receipts`.
4. Leave **Public** turned **OFF**. This matters: the bucket must stay private.
5. Click **Create bucket**.

- [ ] A bucket named `receipts` exists and is **not** public

---

## Step 4: Seed sample listings

**What this does:** fills your catalog with a few sample listings so your site isn't empty.

1. Back in the **SQL Editor**, open a **New query**.
2. Open `db/seed.sql` from your repo, copy all of it, paste, and **Run**.
3. Open the **Table Editor** → `listings` and confirm a few rows appeared.

- [ ] Sample listings appear in the `listings` table

---

## Step 5: Copy your keys

**What these are:** the credentials your website uses to talk to your database.

1. In Supabase, go to **Project Settings → API**.
2. Copy and keep these three values handy:

| Value | Where to find it | Exposure |
|-------|------------------|----------|
| **Project URL** | Settings → API → Project URL | Public (safe in the browser) |
| **anon public key** | Settings → API → Project API keys → `anon` `public` | Public (safe in the browser) |
| **service_role key** | Settings → API → Project API keys → `service_role` | 🔒 **SECRET**, server only, never in the browser |

> 🔒 **Never** paste the `service_role` key into frontend code or commit it to GitHub. It bypasses the security rules and must stay server-side only.

- [ ] You have all three values copied somewhere safe

---

## Step 6: Set the keys locally and on Vercel

Your site reads these from environment variables. You'll set them in **two places**: on your computer (for local preview) and on Vercel (for your live site).

### 6a. Locally (`.env.local`)

1. In VS Code, in your project root, create a file named `.env.local` (copy `.env.example` if it exists).
2. Fill in your values:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

3. Save the file.

> ✅ `.env.local` is already ignored by Git, so your secrets won't be uploaded.

- [ ] `.env.local` has all three values

### 6b. On Vercel

1. Go to your project on [Vercel](https://vercel.com) → **Settings → Environment Variables**.
2. Add the same three variables with the same values:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Save, then go to **Deployments** and **redeploy** the latest one so the new variables take effect.

- [ ] All three variables are set in Vercel and you redeployed

---

## Step 7: Confirm it works

1. Run your site locally (`npm run dev`) or open your live Vercel URL.
2. Submit a test **inquiry** from a listing. It should succeed.
3. Register a test account, then upload a test **receipt**. It should show as **PENDING**.
4. Submit a test **donation**. It should show as **PENDING**.
5. In Supabase **Table Editor**, confirm new rows appeared in `inquiries`, `membership_receipts`, and `donations`.

- [ ] A test inquiry, receipt, and donation all persisted to your database

---

## 🎉 Backend is live!

Your site now runs on your own backend. In **Session 3** you'll seed your own Admin/Staff/User accounts and use the dashboards to review and approve the receipts and donations you just submitted.
