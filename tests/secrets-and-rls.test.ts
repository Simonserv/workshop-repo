/**
 * tests/secrets-and-rls.test.ts — secret-exposure + RLS-policy assertions.
 *
 * Task 11 acceptance criteria 3 & 4, done as STATIC / SQL-POLICY-LEVEL checks
 * that run in CI with NO Supabase instance and NO database connection (per the
 * user's decision):
 *
 *   3. No server-only secret reaches a client bundle. Only the anon key + URL
 *      use the NEXT_PUBLIC_ prefix; SUPABASE_SERVICE_ROLE_KEY is never exposed
 *      to the client.
 *   4. The RLS policies in db/rls.sql (and db/setup.sql) DENY forbidden rows —
 *      asserted by parsing the policy predicates, not by querying a DB. This
 *      complements the app-layer 401/403 unit tests: even if assertRole were
 *      bypassed, the policy text shows the row access is still denied.
 *
 * A `next build` bundle scan is also provided (see tests of the client chunks)
 * but gated behind existence of `.next` so the suite stays runnable without a
 * build; the authoritative secret check here is the static source scan.
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { parsePolicies, readSql, findPolicy } from "./helpers/sql";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

/** Recursively collect files under `dir`, skipping node_modules/.git/.next. */
function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (["node_modules", ".git", ".next", "tests"].includes(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, acc);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

// ===========================================================================
// Criterion 3 — secret exposure (static source scan).
// ===========================================================================
describe("no server-only secret is exposed to the client", () => {
  const sourceFiles = walk(repoRoot);

  it("only NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY use the NEXT_PUBLIC_ prefix", () => {
    const publicVars = new Set<string>();
    const re = /NEXT_PUBLIC_[A-Z0-9_]+/g;
    for (const file of sourceFiles) {
      const text = readFileSync(file, "utf8");
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        publicVars.add(m[0]);
      }
    }
    expect([...publicVars].sort()).toEqual([
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_URL",
    ]);
  });

  it("SUPABASE_SERVICE_ROLE_KEY is never prefixed NEXT_PUBLIC_ anywhere in source", () => {
    for (const file of sourceFiles) {
      const text = readFileSync(file, "utf8");
      expect(text).not.toMatch(/NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/);
      // The service-role key must not be concatenated onto a NEXT_PUBLIC_ name.
      expect(text).not.toMatch(/NEXT_PUBLIC_[A-Z0-9_]*SERVICE_ROLE/);
    }
  });

  it("the service-role key is read only in a server-only module, via a function (never a top-level public const)", () => {
    const env = readSql("lib/env.ts");
    // Read through a function, so merely importing env.ts doesn't surface it.
    expect(env).toMatch(/function getServiceRoleKey\(\)/);
    expect(env).toMatch(/process\.env\.SUPABASE_SERVICE_ROLE_KEY/);

    // The service-role client is guarded by `server-only`.
    const serviceClient = readSql("lib/supabase/service-role.ts");
    expect(serviceClient).toMatch(/import ["']server-only["']/);
    expect(serviceClient).toMatch(/requireServiceRoleKey/);

    // Any module that touches the service-role key / client is server-only.
    for (const rel of [
      "lib/supabase/service-role.ts",
      "lib/admin-users.ts",
    ]) {
      expect(readSql(rel)).toMatch(/import ["']server-only["']/);
    }
  });

  it("the browser client uses ONLY the public env (anon key + URL), never the service-role key", () => {
    const browser = readSql("lib/supabase/browser.ts");
    expect(browser).not.toMatch(/SERVICE_ROLE/);
    expect(browser).not.toMatch(/import ["']server-only["']/); // it's a client module
    expect(browser).toMatch(/requirePublicEnv/);
  });

  it("OPTIONAL client-bundle scan: when .next exists, no built client chunk contains the service-role env name", () => {
    const nextDir = join(repoRoot, ".next");
    if (!existsSync(nextDir)) {
      // No build present — the static source scan above is the authoritative
      // check. Skip the bundle scan rather than fail (keeps the suite runnable
      // with no build step).
      return;
    }
    const staticDir = join(nextDir, "static");
    if (!existsSync(staticDir)) return;
    const files = walk(staticDir);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    }
  });
});

// ===========================================================================
// Criterion 4 — RLS denies forbidden rows (SQL-policy-level assertions).
// ===========================================================================
describe("RLS policies deny forbidden rows (parsed from db/rls.sql)", () => {
  const rls = readSql("db/rls.sql");
  const policies = parsePolicies(rls);

  it("RLS is enabled on every protected table", () => {
    for (const table of [
      "listings",
      "inquiries",
      "membership_receipts",
      "donations",
      "profiles",
    ]) {
      const re = new RegExp(
        `alter table public\\.${table} enable row level security`,
        "i",
      );
      expect(rls).toMatch(re);
    }
  });

  it("listings: writes (insert/update) are ADMIN-only, so Staff/User are denied", () => {
    const insert = findPolicy(policies, "listings_insert");
    const update = findPolicy(policies, "listings_update");
    expect(insert?.predicate).toContain("current_user_role() = 'admin'");
    expect(update?.predicate).toContain("current_user_role() = 'admin'");
    // Not opened to STAFF.
    expect(insert?.predicate).not.toContain("staff");
    expect(update?.predicate).not.toContain("staff");
  });

  it("donations: readable only by Staff/Admin — anon/USER are denied (no owner path)", () => {
    const read = findPolicy(policies, "donations_read");
    expect(read?.command).toBe("select");
    expect(read?.predicate).toContain("current_user_role() in ('staff', 'admin')");
    expect(read?.predicate).not.toContain("auth.uid()");
  });

  it("inquiries + membership_receipts: a USER reads only its own rows; others go to Staff/Admin", () => {
    for (const name of ["inquiries_read", "membership_receipts_read"]) {
      const p = findPolicy(policies, name);
      // Owner path OR Staff/Admin — a non-owning USER row is denied.
      expect(p?.predicate).toMatch(/= auth\.uid\(\)/);
      expect(p?.predicate).toContain("current_user_role() in ('staff', 'admin')");
    }
  });

  it("membership_receipts insert: a user may only insert its OWN row and only as PENDING", () => {
    const insert = findPolicy(policies, "membership_receipts_insert");
    expect(insert?.predicate).toContain("user_id = auth.uid()");
    expect(insert?.predicate).toContain("status = 'pending'");
  });

  it("profiles: role changes (update) are ADMIN-only; read is own-or-admin", () => {
    const update = findPolicy(policies, "profiles_update");
    const read = findPolicy(policies, "profiles_read");
    expect(update?.predicate).toContain("current_user_role() = 'admin'");
    expect(update?.predicate).not.toContain("staff");
    expect(read?.predicate).toMatch(/id = auth\.uid\(\)/);
    expect(read?.predicate).toContain("current_user_role() = 'admin'");
  });

  it("review/approval cannot be bypassed: approve_receipt() re-checks Staff/Admin at the DB layer", () => {
    const fn = rls.slice(rls.indexOf("function public.approve_receipt"));
    // Independent DB-layer guard (SECURITY DEFINER function) → 403 if not Staff/Admin.
    expect(fn).toMatch(/not in \('staff', 'admin'\)/i);
    expect(fn).toMatch(/errcode = '42501'/i);
  });

  it("db/setup.sql carries the same authoritative policies (student one-shot superset)", () => {
    const setup = readSql("db/setup.sql");
    const setupPolicies = parsePolicies(setup);
    // Every policy defined in rls.sql also appears in setup.sql.
    for (const p of policies) {
      const match = findPolicy(setupPolicies, p.name);
      expect(match, `setup.sql missing policy ${p.name}`).toBeDefined();
      expect(match?.predicate).toBe(p.predicate);
    }
  });
});
