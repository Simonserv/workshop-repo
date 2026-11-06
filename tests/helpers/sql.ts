/**
 * tests/helpers/sql.ts — read + lightly parse the RLS policy SQL as text.
 *
 * Task 11 requires asserting that the RLS policies DENY forbidden rows, but per
 * the user's decision these are SQL-POLICY-LEVEL assertions ONLY: no live or
 * local Supabase, no DB connection, no env-gated database. So we read
 * db/rls.sql and db/setup.sql from disk and inspect the policy definitions as
 * text — confirming each policy's command, the predicate that governs it, and
 * that forbidden roles are not granted. Everything runs in CI with no Supabase.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function repoPath(rel: string): string {
  return fileURLToPath(new URL(`../../${rel}`, import.meta.url));
}

export function readSql(rel: string): string {
  return readFileSync(repoPath(rel), "utf8");
}

export interface ParsedPolicy {
  name: string;
  table: string;
  command: string; // select | insert | update | delete | all
  /** The combined USING + WITH CHECK predicate text (lowercased, collapsed). */
  predicate: string;
}

/**
 * Extracts `create policy …` statements from a SQL string. Deliberately small:
 * it matches the exact shape used in db/rls.sql / db/setup.sql
 * (`create policy <name> on <table> for <cmd> using (...) with check (...)`),
 * capturing the predicate text so tests can assert what each policy allows.
 */
export function parsePolicies(sql: string): ParsedPolicy[] {
  const policies: ParsedPolicy[] = [];
  // Match "create policy <name> on <schema.table> for <cmd> ... ;"
  const re =
    /create\s+policy\s+(\w+)\s+on\s+([\w.]+)\s+for\s+(select|insert|update|delete|all)\b([\s\S]*?);/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const [, name, table, command, body] = m;
    policies.push({
      name,
      table: table.replace(/^public\./, ""),
      command: command.toLowerCase(),
      predicate: body.replace(/\s+/g, " ").trim().toLowerCase(),
    });
  }
  return policies;
}

export function findPolicy(
  policies: ParsedPolicy[],
  name: string,
): ParsedPolicy | undefined {
  return policies.find((p) => p.name === name);
}
