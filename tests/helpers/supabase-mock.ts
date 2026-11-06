/**
 * tests/helpers/supabase-mock.ts — a tiny, controllable fake Supabase client.
 *
 * The domain modules under test (`lib/membership.ts`, `lib/donations.ts`, …)
 * talk to Supabase only through the thin factory modules
 * `@/lib/supabase/server` and `@/lib/supabase/service-role`. Each test file
 * mocks those factories (via `vi.mock`) to return a `FakeSupabase` built here,
 * so the real domain logic runs unchanged against scripted responses — no live
 * Supabase instance, no network (Task 11: everything runs in CI with no DB).
 *
 * The fake implements just the fluent surface these modules use:
 *   - `auth.getUser()`                         → session resolution (auth.ts)
 *   - `.from(table).select(...).eq(...).single()/.maybeSingle()`  → reads
 *   - `.from(table).insert(...).select(...).single()`             → inserts
 *   - `.from(table).update(...).eq(...).select(...)`              → updates
 *   - `.rpc(name, args)`                        → approve_receipt()
 *   - `.storage.from(bucket).upload()/createSignedUrl()`          → storage
 *
 * A query chain is terminal-awaitable: every builder is a thenable that
 * resolves to the configured `{ data, error }` for its table+operation, and the
 * chainable methods (`select`, `eq`, `order`, …) return the same builder so any
 * call order the code uses resolves to that result.
 */

import { vi } from "vitest";

export type PostgrestResult<T = unknown> = {
  data: T;
  error: { code?: string; message?: string } | null;
};

/** One scripted response for a table + operation. */
export interface TableScript {
  select?: PostgrestResult;
  insert?: PostgrestResult;
  update?: PostgrestResult;
}

export interface FakeConfig {
  /** Result of `auth.getUser()`. */
  user?: { id: string } | null;
  userError?: { message?: string } | null;
  /** Per-table scripted results keyed by table name. */
  tables?: Record<string, TableScript>;
  /** Result of `.rpc(name, args)` keyed by rpc name. */
  rpc?: Record<string, PostgrestResult>;
  /** Storage behaviour. */
  storage?: {
    uploadError?: { message?: string } | null;
    signedUrl?: string | null;
    signedUrlError?: { message?: string } | null;
  };
}

/** Builds a thenable query builder that resolves to `result`. */
function makeQueryBuilder(result: PostgrestResult) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  for (const method of [
    "select",
    "insert",
    "update",
    "delete",
    "eq",
    "neq",
    "order",
    "limit",
  ]) {
    builder[method] = vi.fn(chain);
  }
  // Terminal resolvers return the configured result directly.
  builder.single = vi.fn(async () => result);
  builder.maybeSingle = vi.fn(async () => result);
  // The builder itself is awaitable (e.g. update().eq().select() with no
  // single()): resolve to the configured result.
  builder.then = (
    onfulfilled: (value: PostgrestResult) => unknown,
    onrejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(onfulfilled, onrejected);
  return builder;
}

const EMPTY: PostgrestResult = { data: null, error: null };

export function createFakeSupabase(config: FakeConfig = {}) {
  const fromCalls: string[] = [];
  const rpcCalls: { name: string; args: unknown }[] = [];
  const uploadCalls: { bucket: string; key: string }[] = [];
  const signedUrlCalls: { bucket: string; key: string; expiresIn: number }[] =
    [];

  const client = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: config.user ?? null },
        error: config.userError ?? null,
      })),
    },
    from(table: string) {
      fromCalls.push(table);
      const script = config.tables?.[table] ?? {};
      // Pick the scripted result for whichever op the chain terminates in.
      // insert/update chains call .insert()/.update() first; select chains
      // call .select() first. We return a builder whose terminal result is the
      // op-specific script, falling back through select/insert/update → EMPTY.
      const builder: Record<string, unknown> = {};
      const chain = () => builder;
      const resultFor = (op: "select" | "insert" | "update") =>
        script[op] ?? script.select ?? EMPTY;

      builder.select = vi.fn(() => makeQueryBuilder(resultFor("select")));
      builder.insert = vi.fn(() => makeQueryBuilder(resultFor("insert")));
      builder.update = vi.fn(() => makeQueryBuilder(resultFor("update")));
      builder.delete = vi.fn(chain);
      return builder;
    },
    rpc: vi.fn(async (name: string, args: unknown) => {
      rpcCalls.push({ name, args });
      return config.rpc?.[name] ?? EMPTY;
    }),
    storage: {
      from(bucket: string) {
        return {
          upload: vi.fn(async (key: string) => {
            uploadCalls.push({ bucket, key });
            return {
              data: config.storage?.uploadError ? null : { path: key },
              error: config.storage?.uploadError ?? null,
            };
          }),
          createSignedUrl: vi.fn(async (key: string, expiresIn: number) => {
            signedUrlCalls.push({ bucket, key, expiresIn });
            return {
              data: config.storage?.signedUrlError
                ? null
                : { signedUrl: config.storage?.signedUrl ?? "https://signed/url" },
              error: config.storage?.signedUrlError ?? null,
            };
          }),
        };
      },
    },
  };

  return {
    client,
    calls: { fromCalls, rpcCalls, uploadCalls, signedUrlCalls },
  };
}

/** A minimal File-like object usable by the receipt validators/uploads. */
export function makeFakeFile(opts: {
  type?: string;
  size?: number;
}): File {
  const type = opts.type ?? "image/png";
  const size = opts.size ?? 1024;
  return {
    type,
    size,
    name: "receipt",
    arrayBuffer: async () => new ArrayBuffer(0),
  } as unknown as File;
}
