# Task 1 — Scaffold the single Next.js app and base layout

Status: completed
Requirements: 1.1, 1.2, 1.4 (1.3 covered as a bonus)

## What was built
Next.js 14 (App Router, TypeScript) scaffold, Vercel-ready. Root layout + shared
navigation (landing <-> catalog <-> auth), base styling, and placeholder routes so
the app runs locally and deploys. The three editable content files that students
customize were created and wired into the landing and catalog pages.

## Files
- Config: package.json, tsconfig.json, next.config.mjs, next-env.d.ts, .gitignore, README.md
- Layout/nav: app/layout.tsx, app/_components/SiteNav.tsx, app/globals.css
- Routes: app/page.tsx (landing), app/catalog/page.tsx, app/login/page.tsx
- Content (student-editable): content/site.ts, content/listings.ts, content/payment.ts
- Assets: public/images/placeholder-consulting.svg, placeholder-web-dev.svg, placeholder-custom-software.svg

## Verification
npm run build succeeded: compiled successfully, type-check + lint passed, all 6
routes prerendered (/, /catalog, /login, /_not-found). Verified with Node v26.13.0,
npm 11.20.0.
