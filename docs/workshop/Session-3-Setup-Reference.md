# Session 3 Reference: Operate the Business

In Session 3 you'll create your own staff accounts, use the dashboards to review and approve the receipts and donations from Session 2, and ship your final site.

> Prerequisite: you finished [Session 2](./Session-2-Setup-Reference.md) and your backend is connected.

## What you'll have by the end

- Your own Admin, Staff, and User accounts
- Hands-on experience approving receipts (granting membership) and verifying donations
- A final, deployed site you fully own and can operate

---

## ✅ Session 3 Checklist

- [ ] Seeded your own Admin / Staff / User accounts
- [ ] Triaged an inquiry in the dashboard
- [ ] Approved a receipt (member became a MEMBER)
- [ ] Rejected a receipt with a reason
- [ ] Verified and rejected a donation
- [ ] Managed a listing (create/edit/publish) and assigned a role
- [ ] Saw the security rules in action (403 / blocked access)
- [ ] Pushed final changes and confirmed your live site updated

---

## Step 1: Seed your Admin / Staff / User accounts

**What this does:** gives you login accounts with each role so you can see every dashboard.

1. On your **live site**, register three accounts first (e.g. an admin, a staff, and a regular user email) so the logins already exist.
2. In your Supabase project, open the **SQL Editor**, then open `db/seed-roles.sql` from your repo and follow its steps to set one account to **Admin** and one to **Staff** (leave the third as **User**).

- [ ] You have one Admin, one Staff, and one User account

> 💡 Register the accounts *before* running `db/seed-roles.sql`. The script promotes accounts that already exist.

---

## Step 2: Triage an inquiry

1. Log in with your **Staff** or **Admin** account.
2. Open the **Inquiries** dashboard.
3. Change an inquiry's status (e.g. NEW → IN_PROGRESS) and assign a handler.

- [ ] An inquiry's status updated

---

## Step 3: Review receipts (grant membership)

1. Open the **Receipts** dashboard (Staff/Admin only).
2. Open a **PENDING** receipt using its secure view link.
3. Click **Approve**. The member's status should change to **MEMBER**.
4. Open another and **Reject** it with a short reason.

- [ ] Approving a receipt turned the user into a MEMBER
- [ ] Rejecting a receipt recorded a reason

> 🔒 The receipt link is short-lived and only works for Staff/Admin. Receipts are never public.

---

## Step 4: Review donations

1. Open the **Donations** dashboard.
2. **Verify** a PENDING donation, and **Reject** another with a reason.

- [ ] A donation was verified
- [ ] A donation was rejected with a reason

---

## Step 5: Manage listings and roles (Admin)

1. As **Admin**, create or edit a listing and toggle it **published / unpublished**.
2. In the **Members** dashboard, change a member's role (User → Staff) and watch it take effect.

- [ ] You created/edited a listing and toggled publish
- [ ] You changed a member's role

---

## Step 6: See the security in action

1. Log in as a plain **User** (or log out).
2. Try to open an Admin/Staff page. You should be blocked (a **403 / access denied**).

- [ ] A non-staff account was blocked from privileged pages

> 💡 This is the key lesson: even if someone bypasses the buttons, the database security rules (RLS) still block access.

---

## Step 7: Final deploy and showcase

1. Push any final changes:

```bash
git add .
git commit -m "Final workshop changes"
git push
```

2. Confirm Vercel auto-deployed your latest version.
3. Open your live URL and visit a few classmates' sites too.

- [ ] Your final site is live and up to date

---

## 🎉 You built and operated a three-tier website!

You now own a live catalog site with real membership, payments (checked by hand), donations, and role-based dashboards. Your own code, your own database, your own hosting.
