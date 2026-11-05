# Task 2.1 — Define the env contract and example file

Status: completed
Requirements: 14.3, 14.4
Parent: Task 2 (Configure environment variables and Supabase client factories)

## What was built
The environment-variable contract for the app. Exactly three vars, with the
public vs server-only split documented and type-enforced. No Supabase clients
were created (that is task 2.2).

## Files
- .env.example (committed) — documents all three vars with exposure scopes and
  copy instructions; warns never to prefix the service-role key with NEXT_PUBLIC_.
- lib/env.ts — typed env contract. publicEnv + requirePublicEnv() for the two
  public vars; getServiceRoleKey()/requireServiceRoleKey() gate the server-only
  key behind a function so importing from a client component does not read it.

## Env contract
- PUBLIC (NEXT_PUBLIC_): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
- SERVER-ONLY (never NEXT_PUBLIC_): SUPABASE_SERVICE_ROLE_KEY

## Verification
npm run build succeeded (all 6 routes, type-check + lint passed). lib/env.ts has
no diagnostics. .env.example is NOT gitignored; .env / .env*.local remain ignored.
