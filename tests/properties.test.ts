/**
 * tests/properties.test.ts — property tests for the SEVEN Correctness Properties.
 *
 * Source of the invariants: design.md "Correctness Properties" (Properties 1–7)
 * and requirements.md "Correctness Properties". One test block per property.
 *
 * These are instructor-maintained and OPTIONAL (Task 11, off the student
 * critical path). They run in Node with no Supabase instance: domain modules
 * run against the fake Supabase client, and the RLS-boundary assertions are
 * SQL-policy-level (parsing db/rls.sql), never a live database.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";

import { createFakeSupabase, makeFakeFile } from "./helpers/supabase-mock";
import { parsePolicies, readSql, findPolicy } from "./helpers/sql";

// The server + service-role factories are mocked; each test installs a fake
// client via `setServerClient` / `setServiceClient` before exercising the
// domain module.
let serverClient: ReturnType<typeof createFakeSupabase>["client"] | null = null;
let serviceClient: ReturnType<typeof createFakeSupabase>["client"] | null = null;

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => serverClient,
}));
vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleSupabaseClient: () => serviceClient,
}));

function setServer(config: Parameters<typeof createFakeSupabase>[0]) {
  const fake = createFakeSupabase(config);
  serverClient = fake.client;
  serviceClient = createFakeSupabase(config).client;
  return fake;
}

/** Build the `tables` entry that makes `assertRole`/`getRoleFromSession` resolve a role. */
function sessionTables(role: "ADMIN" | "STAFF" | "USER" | null) {
  return {
    profiles: {
      select: role
        ? { data: { role }, error: null }
        : { data: null, error: { message: "no profile" } },
    },
  };
}

beforeEach(() => {
  serverClient = null;
  serviceClient = null;
  vi.resetModules();
});

// ---------------------------------------------------------------------------
// Property 1: Membership is only granted by approval.
// `membership_status = MEMBER` ⟹ an APPROVED receipt exists; the ONLY path that
// sets MEMBER is the atomic approve_receipt() function, invoked by
// approveReceipt(). Validates Requirements 8.3, 8.4.
// ---------------------------------------------------------------------------
describe("Property 1: membership is only granted by approval", () => {
  it("approveReceipt is the sole membership-granting path and calls approve_receipt() atomically", async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (receiptId) => {
        const fake = setServer({
          user: { id: "staff-1" },
          tables: {
            ...sessionTables("STAFF"),
          },
          rpc: { approve_receipt: { data: { id: receiptId }, error: null } },
        });
        const { approveReceipt } = await import("@/lib/membership");
        const result = await approveReceipt(receiptId);

        expect(result.ok).toBe(true);
        // Membership is granted only via the atomic RPC, with the receipt id.
        expect(fake.calls.rpcCalls).toEqual([
          { name: "approve_receipt", args: { p_receipt_id: receiptId } },
        ]);
      }),
      { numRuns: 25 },
    );
  });

  it("the app never writes membership_status=MEMBER directly; only approve_receipt() does (in SQL)", async () => {
    // Static guarantee: no application module performs a profiles update that
    // sets membership_status. The only MEMBER write lives in approve_receipt().
    const rls = readSql("db/rls.sql");
    const approveFn = rls.slice(rls.indexOf("function public.approve_receipt"));
    expect(approveFn).toMatch(/set\s+membership_status\s*=\s*'MEMBER'/i);

    // assignRole (the only app-layer profiles write) updates ONLY `role` —
    // it never writes membership_status (it appears only as a read column in
    // the DbProfile type, not in any update payload).
    const adminUsers = readSql("lib/admin-users.ts");
    expect(adminUsers).toMatch(/\.update\(\{\s*role:/);
    expect(adminUsers).not.toMatch(/\.update\([^)]*membership_status/s);
    // No application source outside the approval RPC writes membership_status.
    for (const rel of [
      "lib/membership.ts",
      "lib/admin-users.ts",
      "lib/donations.ts",
    ]) {
      expect(readSql(rel)).not.toMatch(
        /\.update\([^)]*membership_status[^)]*\)/s,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Property 2: Privileged access is always authorized.
// Any Staff/Admin action without a valid Staff/Admin context → 401/403, and RLS
// denies the row regardless of the app check. Validates Requirements 6, 7,
// 12.5, 14.1, 14.2.
// ---------------------------------------------------------------------------
describe("Property 2: privileged access is always authorized", () => {
  it("no session → 401 and a wrong role → 403 for a privileged read, for any role", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<"ADMIN" | "STAFF" | "USER" | null>(
          "USER",
          null,
        ),
        async (role) => {
          // Admin-only action (listMembers): USER → 403, no session → 401.
          setServer({
            user: role ? { id: "u" } : null,
            userError: role ? null : { message: "no session" },
            tables: sessionTables(role),
          });
          const { listMembers } = await import("@/lib/admin-users");
          const res = await listMembers();
          expect(res.ok).toBe(false);
          if (!res.ok) {
            expect(res.status).toBe(role === null ? 401 : 403);
          }
        },
      ),
      { numRuns: 20 },
    );
  });

  it("RLS (not the app) is the authoritative boundary: privileged tables are Staff/Admin-only in SQL", () => {
    const policies = parsePolicies(readSql("db/rls.sql"));
    // donations are readable only by STAFF/ADMIN (no owner path).
    const donationsRead = findPolicy(policies, "donations_read");
    expect(donationsRead?.predicate).toContain("in ('staff', 'admin')");
    expect(donationsRead?.predicate).not.toContain("auth.uid()");
    // inquiry/receipt UPDATES are Staff/Admin-only.
    for (const name of ["inquiries_update", "membership_receipts_update"]) {
      const p = findPolicy(policies, name);
      expect(p?.predicate).toContain("in ('staff', 'admin')");
    }
  });
});

// ---------------------------------------------------------------------------
// Property 3: Receipts are never publicly reachable.
// A receipt file_key is viewable only via a Staff/Admin-minted short-lived
// signed URL; no stored field is a permanent public URL. Validates Req 10.
// ---------------------------------------------------------------------------
describe("Property 3: receipts are never publicly reachable", () => {
  it("getReceiptViewUrl requires Staff/Admin and mints a short-lived signed URL", async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), fc.webUrl(), async (receiptId, signed) => {
        const fake = setServer({
          user: { id: "staff" },
          tables: {
            ...sessionTables("ADMIN"),
            membership_receipts: {
              select: { data: { file_key: "receipts/x.png" }, error: null },
            },
          },
          storage: { signedUrl: signed },
        });
        const { getReceiptViewUrl } = await import("@/lib/membership");
        const res = await getReceiptViewUrl(receiptId);
        expect(res.ok).toBe(true);
        if (res.ok) expect(res.url).toBe(signed);
        // A signed URL was minted with a short TTL (~300s), never a public URL.
        expect(fake.calls.signedUrlCalls.length).toBe(1);
        expect(fake.calls.signedUrlCalls[0].expiresIn).toBeLessThanOrEqual(300);
      }),
      { numRuns: 20 },
    );
  });

  it("the storage client returns/persists only a file_key and never a public URL", () => {
    const storage = readSql("lib/storage/receipts.ts");
    // No use of getPublicUrl anywhere in the receipts storage boundary.
    expect(storage).not.toMatch(/getPublicUrl/);
    // Viewing is via createSignedUrl with a ~300s TTL.
    expect(storage).toMatch(/SIGNED_URL_TTL_SECONDS\s*=\s*300/);
    expect(storage).toMatch(/createSignedUrl/);
  });
});

// ---------------------------------------------------------------------------
// Property 4: Inquiry integrity.
// Every persisted inquiry references a listing published/active at submission
// time. The route inserts ONLY after confirming listing.is_published.
// Validates Requirement 4.3.
// ---------------------------------------------------------------------------
describe("Property 4: inquiry integrity", () => {
  it("rejects (400) and persists nothing when the listing is unpublished or missing", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.option(fc.boolean(), { nil: undefined }),
        async (listingId, publishedState) => {
          // publishedState: true=published, false=unpublished, undefined=missing
          const listingSelect =
            publishedState === undefined
              ? { data: null, error: null }
              : {
                  data: { id: listingId, is_published: publishedState },
                  error: null,
                };
          const fake = setServer({
            user: null,
            userError: { message: "anon" },
            tables: {
              listings: { select: listingSelect },
              inquiries: { insert: { data: { id: "i" }, error: null } },
              ...sessionTables(null),
            },
          });
          const { POST } = await import("@/app/api/inquiries/route");
          const req = new Request("http://test/api/inquiries", {
            method: "POST",
            body: JSON.stringify({
              listingId,
              name: "Jo",
              email: "jo@example.com",
              details: "Hi there",
            }),
          });
          const res = await POST(req);

          if (publishedState === true) {
            expect(res.status).toBe(201);
            expect(fake.calls.fromCalls).toContain("inquiries");
          } else {
            // Unpublished or missing listing → 400 and NO inquiry insert.
            expect(res.status).toBe(400);
            expect(fake.calls.fromCalls).not.toContain("inquiries");
          }
        },
      ),
      { numRuns: 25 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5: Review is terminal and single.
// Once a receipt/donation is reviewed, further review attempts → 409.
// Validates Requirements 8.6, 9.9.
// ---------------------------------------------------------------------------
describe("Property 5: review is terminal and single", () => {
  it("rejecting/verifying a non-PENDING donation returns 409 for any terminal status", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.constantFrom("VERIFIED", "REJECTED"),
        async (donationId, existingStatus) => {
          setServer({
            user: { id: "staff" },
            tables: {
              ...sessionTables("STAFF"),
              donations: {
                select: {
                  data: { id: donationId, status: existingStatus },
                  error: null,
                },
              },
            },
          });
          const { verifyDonation, rejectDonation } = await import(
            "@/lib/donations"
          );
          const v = await verifyDonation(donationId);
          const r = await rejectDonation(donationId, "dup");
          expect(v.ok).toBe(false);
          expect(r.ok).toBe(false);
          if (!v.ok) expect(v.status).toBe(409);
          if (!r.ok) expect(r.status).toBe(409);
        },
      ),
      { numRuns: 20 },
    );
  });

  it("approve_receipt() raises the 409-mapped error on a non-PENDING receipt (SQL)", () => {
    const rls = readSql("db/rls.sql");
    const fn = rls.slice(rls.indexOf("function public.approve_receipt"));
    // Non-PENDING guard that maps to 409 in the app layer (errcode 23505).
    expect(fn).toMatch(/status\s*<>\s*'PENDING'/i);
    expect(fn).toMatch(/errcode\s*=\s*'23505'/i);
  });
});

// ---------------------------------------------------------------------------
// Property 6: Donation amount validity.
// Donations persist only when amount > 0. Validates Requirement 9.2.
// ---------------------------------------------------------------------------
describe("Property 6: donation amount validity", () => {
  it("any amount <= 0 (or non-numeric) is rejected 400 with no upload/insert", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.integer({ min: -10000, max: 0 }),
          fc.constant(0),
          fc.constantFrom("", "abc", "NaN"),
        ),
        async (amount) => {
          const fake = setServer({ tables: {} });
          const { submitDonation } = await import("@/lib/donations");
          const res = await submitDonation({
            amount,
            file: makeFakeFile({ type: "image/png" }),
          });
          expect(res.ok).toBe(false);
          if (!res.ok) expect(res.status).toBe(400);
          // Non-positive amount is rejected before any upload or DB insert.
          expect(fake.calls.uploadCalls.length).toBe(0);
          expect(fake.calls.fromCalls).not.toContain("donations");
        },
      ),
      { numRuns: 40 },
    );
  });

  it("a positive amount with a valid file persists PENDING", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.double({ min: 0.01, max: 1_000_000, noNaN: true }),
        async (amount) => {
          const fake = setServer({
            tables: { donations: { insert: { data: null, error: null } } },
            storage: {},
          });
          const { submitDonation } = await import("@/lib/donations");
          const res = await submitDonation({
            amount,
            file: makeFakeFile({ type: "image/png" }),
          });
          expect(res.ok).toBe(true);
          if (res.ok) expect(res.donationStatus).toBe("PENDING");
          expect(fake.calls.uploadCalls.length).toBe(1);
        },
      ),
      { numRuns: 25 },
    );
  });

  it("the schema enforces amount > 0 at the database (SQL CHECK)", () => {
    const setup = readSql("db/setup.sql");
    expect(setup.toLowerCase()).toMatch(/check\s*\(\s*amount\s*>\s*0\s*\)/);
  });
});

// ---------------------------------------------------------------------------
// Property 7: RBAC trusts the database, not the client.
// The authorization role is always read from the persisted profiles record,
// and RLS is the authoritative boundary. Validates Requirements 6.1, 7.
// ---------------------------------------------------------------------------
describe("Property 7: RBAC trusts the database, not the client", () => {
  it("getRoleFromSession reads profiles.role for the verified user id, ignoring any client-claimed role", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<"ADMIN" | "STAFF" | "USER">("ADMIN", "STAFF", "USER"),
        fc.uuid(),
        async (dbRole, userId) => {
          setServer({
            user: { id: userId },
            tables: sessionTables(dbRole),
          });
          const { getRoleFromSession } = await import("@/lib/auth");
          const resolution = await getRoleFromSession();
          expect(resolution.authenticated).toBe(true);
          if (resolution.authenticated) {
            // Role comes from the DB profile, keyed by the verified user id.
            expect(resolution.role).toBe(dbRole);
            expect(resolution.userId).toBe(userId);
          }
        },
      ),
      { numRuns: 20 },
    );
  });

  it("every RLS policy resolves the role via current_user_role(), never from client input (SQL)", () => {
    const rls = readSql("db/rls.sql");
    // The helper resolves role from profiles by auth.uid().
    expect(rls).toMatch(
      /function public\.current_user_role[\s\S]*?select role from public\.profiles where id = auth\.uid\(\)/i,
    );
    // Policies that gate by role use the helper (not a client-supplied value).
    const policies = parsePolicies(rls);
    const roleGated = policies.filter((p) =>
      p.predicate.includes("'staff', 'admin'") ||
      p.predicate.includes("= 'admin'"),
    );
    expect(roleGated.length).toBeGreaterThan(0);
    for (const p of roleGated) {
      expect(p.predicate).toContain("current_user_role()");
    }
  });
});
