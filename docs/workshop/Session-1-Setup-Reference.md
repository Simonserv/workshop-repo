# Session 1 Reference: Build the Storefront

In Session 1 you'll get your own copy of the project running, put it live on the internet, and customize the public catalog. By the end you'll have a personalized site at your own URL.

> Prerequisite: you finished the [Prerequisites](./Prerequisites.md) checklist.

## What you'll have by the end

- Your own fork of the project, running on your computer
- A live website on your own Vercel URL
- A catalog customized with your own listings and images

---

## ✅ Session 1 Checklist

- [ ] Forked the repo into your own GitHub account
- [ ] Cloned it and ran it locally (`npm install`, `npm run dev`)
- [ ] Deployed it to your own Vercel project (got a live URL)
- [ ] Customized the landing text and branding
- [ ] Customized the catalog listings and images
- [ ] Confirmed the catalog and inquiry forms show on your live site

---

## Step 1: Fork and clone the project

1. Open the workshop repo link (provided by the instructor) and click **Fork** (top right) to copy it into **your** GitHub account.
2. On your fork, click the green **Code** button and copy the **HTTPS** URL.
3. In the VS Code terminal, clone it (paste your URL):

```bash
git clone https://github.com/your-username/your-fork.git
cd your-fork
```

- [ ] Your fork is cloned and open in VS Code

---

## Step 2: Run it locally

```bash
npm install
npm run dev
```

Open the URL it prints (usually `http://localhost:3000`) in your browser.

- [ ] The site loads locally

---

## Step 3: Deploy to your own Vercel

1. Go to [Vercel](https://vercel.com) → **Add New → Project**.
2. Import **your fork** from GitHub.
3. Keep the defaults and click **Deploy**.
4. Wait for it to finish, then open your live URL.

- [ ] Your site is live on a Vercel URL

> 💡 From now on, every time you push changes to GitHub, Vercel re-deploys automatically.

---

## Step 4: Customize your landing page

1. Open `content/site.ts` in VS Code.
2. Change the **site name**, **headline**, and **intro text** to your own.
3. Save and refresh your browser.

- [ ] Your landing page shows your own text

---

## Step 5: Customize your catalog

1. Open `content/listings.ts`.
2. For each listing, edit the **title**, **description**, **category**, and **inquiry type** (DEMO / QUOTE / INQUIRE).
3. Drop your images into `public/images/` and point each listing's `image_url` at them (e.g. `/images/my-service.png`).
4. Save and refresh.

> 💡 To add a listing, copy one entry and change its values. It works just like editing a list.

- [ ] Your catalog shows your listings and images
- [ ] Each listing's detail page shows the right inquiry form

---

## 🎉 Session 1 done!

Your personalized catalog is live. In **Session 2** you'll create your own backend so the inquiry, membership, and donation forms actually save data.

> Note: inquiry forms won't save yet. That happens in Session 2 once your backend is connected.
