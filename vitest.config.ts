/**
 * vitest.config.ts — test runner configuration (instructor-maintained tests).
 *
 * These tests are OPTIONAL and off the student critical path (Task 11). They
 * run entirely in Node with NO Supabase instance and NO network: domain modules
 * are exercised against mocked Supabase clients, and the RLS checks are
 * SQL-policy-level assertions that parse db/rls.sql + db/setup.sql as text.
 *
 * Two bits of wiring make the server-only app modules importable under Vitest:
 *   - `@/…` is aliased to the repo root, matching tsconfig `paths`.
 *   - `server-only` (which throws when imported outside an RSC/server context)
 *     is aliased to a local no-op stub so `import 'server-only'` is inert in
 *     tests. This does not weaken the guarantee: `next build` still enforces
 *     that those modules never reach a Client Component.
 */

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "server-only": fileURLToPath(
        new URL("./tests/stubs/server-only.ts", import.meta.url),
      ),
      "@": rootDir,
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: false,
  },
});
