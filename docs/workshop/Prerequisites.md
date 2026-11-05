# Prerequisites (Complete Before Session 1)

Before our first session, please finish every section below. That way class time goes into building and customizing your website, not waiting on sign-up emails or installers.

This workshop builds a **three-tier website** (a public catalog with inquiries, membership with payment receipts, donations, and Admin/Staff dashboards). You will own your own copy of everything: your own code repository, your own database, and your own live website.

> ⏱️ Set aside about **45 to 60 minutes**. Most of it is account sign-ups and one install.

## What you are setting up and why

| Tool | What it is | Why you need it |
|------|------------|-----------------|
| **GitHub** | Where your code lives online (version control) | You'll fork the workshop project into your own account and connect it to hosting |
| **Node.js** | Runtime that runs the website on your computer | Required to run and build the Next.js app locally |
| **VS Code** | Code editor | Where you'll open files and customize your site |
| **Supabase** | Your database + login + file storage, all in one | Powers membership, inquiries, donations, and receipt storage |
| **Vercel** | Website hosting | Puts your site live on the internet with a public URL |
| **GCash QR image** | A screenshot of your GCash QR | Shown to members/donors so they can pay (we only verify manually) |

> 💡 Everything here is **free**. No credit card is required for any account at workshop scale.

---

## ✅ Pre-Session Checklist (tick each one)

- [ ] GitHub account created and email verified
- [ ] Node.js (LTS) installed, and `node -v` prints a version
- [ ] VS Code installed
- [ ] Git installed and configured with your name/email
- [ ] Supabase account created (signed in with GitHub)
- [ ] Vercel account created (signed in with GitHub)
- [ ] A GCash QR screenshot saved and ready
- [ ] You can open a terminal and run `node -v`, `git --version`

Work through each section below to check these off.

---

## Section 1: GitHub Account

**What is GitHub?** It's where your project's code is stored online so you can track changes and connect it to hosting.

1. Go to [https://github.com/signup](https://github.com/signup).
2. Enter your email, create a password, and pick a username.
3. Verify your email address (check your inbox for the confirmation).
4. You're done when you land on your GitHub home page.

> 💡 **Remember your username and password.** You'll sign in to Supabase and Vercel *with GitHub*, so this one account unlocks the others.

---

## Section 2: Node.js (LTS)

**What is Node.js?** It runs the website's JavaScript on your computer so you can preview your site locally before putting it online.

1. Go to [https://nodejs.org](https://nodejs.org).
2. Download the **LTS** version (the left button, labeled "Recommended For Most Users").
3. Run the installer and accept the default options. On the setup screen, leave **"Add to PATH"** checked.
4. Finish the installer.

**Verify it worked.** Open a terminal (see Section 5 if you're unsure how) and run:

```bash
node -v
npm -v
```

You should see a version number for each (for example `v20.x.x`). If you get "command not found," restart your computer and try again.

---

## Section 3: Visual Studio Code (VS Code)

**What is VS Code?** The code editor where you'll open and customize your website's files.

> If you already have VS Code, skip this section.

1. Go to [https://code.visualstudio.com](https://code.visualstudio.com) and download the version for your operating system.
2. Run the installer, accept the license, and keep the default options.
   - On Windows, make sure **"Add to PATH"** is checked.
3. Click Finish.

---

## Section 4: Install and Configure Git

**What is Git?** The tool that saves and uploads your code changes to GitHub.

1. Install Git:
   - **Windows:** download from [https://git-scm.com/download/win](https://git-scm.com/download/win) and run the installer with default options.
   - **macOS:** run `git --version` in the terminal. If Git isn't installed, macOS will prompt you to install it. You can also install it from [https://git-scm.com/download/mac](https://git-scm.com/download/mac).
2. Verify the install:

```bash
git --version
```

3. Configure your identity (use the **same email as your GitHub account**). Replace the values inside the quotes:

```bash
git config --global user.name "Your Name"
git config --global user.email "yourname@example.com"
```

4. Set the default branch name to `main`:

```bash
git config --global init.defaultBranch main
```

---

## Section 5: Opening a Terminal (quick reference)

You'll run commands in a terminal throughout the workshop. The easiest option is the built-in VS Code terminal.

1. Open **VS Code**.
2. In the top menu, choose **Terminal → New Terminal** (or press `` Ctrl+` `` on Windows / `` Cmd+` `` on macOS).
3. A terminal panel opens at the bottom. Try `node -v` to confirm it works.

> 💡 Any command block in the workshop can be pasted here and run with Enter.

---

## Section 6: Supabase Account

**What is Supabase?** Your project's **database, login system, and file storage** on one platform. In Session 2 you'll create your own Supabase project and run a provided setup script against it. For now, just create the account.

1. Go to [https://supabase.com](https://supabase.com) and click **Start your project** / **Sign up**.
2. Choose **Continue with GitHub** and authorize Supabase. (Signing in with GitHub means one less password to remember.)
3. You'll land on the Supabase dashboard.

> ⚠️ **Do not create a project yet.** We'll do that together in Session 2 so everyone sets it up the same way. Just make sure you can log in.

---

## Section 7: Vercel Account

**What is Vercel?** The hosting service that makes your website live on the internet. Every time you push code to GitHub, Vercel can automatically re-deploy your site.

1. Go to [https://vercel.com/signup](https://vercel.com/signup).
2. Choose **Continue with GitHub** and authorize Vercel.
3. If it asks about a team/plan, choose the **free / Hobby** option.
4. You'll land on the Vercel dashboard.

> ⚠️ **Do not import a project yet.** We'll connect your forked repo to Vercel together in Session 1. Just make sure you can log in.

---

## Section 8: Prepare Your GCash QR Image

**Why?** Your site shows a GCash QR so members and donors can pay. (We only verify payments by hand. The workshop never processes real money.)

1. On your phone, open GCash and go to your **personal QR / "Receive Money" QR** screen.
2. Take a screenshot.
3. Transfer it to your computer (email it to yourself, AirDrop, cable, or cloud drive).
4. Save it somewhere easy to find and name it clearly, for example `gcash-qr.png`.

> 🔒 **Privacy note:** this QR will appear on your live website. If you'd rather not share your real QR, you can use any placeholder QR image for the workshop. The verification flow works the same.
>
> If you don't have GCash, that's fine. Bring **any** QR-code image (even a placeholder) so you have something to drop into the site.

---

## 🧯 Troubleshooting

- **`node` or `git` says "command not found" after installing.** Close and reopen the terminal, or restart your computer so the PATH updates.
- **Didn't get the GitHub verification email.** Check spam and junk. You can resend it from the GitHub prompt.
- **"Continue with GitHub" won't authorize on Supabase/Vercel.** Make sure you're logged in to GitHub in the same browser, then try again.
- **Not sure if something installed.** Run the verify commands in Sections 2 and 4. A version number means success.

---

## 🎉 You're ready!

Once every box in the checklist is ticked, you're set for **Session 1: Build the storefront**, where you'll fork the project, run it locally, and deploy your own live site.

> Bring your laptop charged, and keep your GitHub login handy. You'll use it to sign in everywhere.
