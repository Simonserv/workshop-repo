/**
 * tests/auth-and-errors.test.ts — unit tests for the error-path contract.
 *
 * Covers (Task 11):
 *   - 401 (invalid/expired/absent session) vs 403 (insufficient role) across
 *     Staff/Admin- and Admin-only domain functions, plus assertRole directly.
 *   - Input-validation paths: inquiry field-level 400s, donation amount/file
 *     400s, listing input 400s, invalid role / status 400s.
 *   - Review 409-on-non-PENDING for receipts and donations (terminal + single).
 *
 * Runs in Node with no Supabase instance (fake client); instructor-maintained,
 * off the student critical path.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeSupabase, makeFakeFile } from "./helpers/supabase-mock";

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
  // The service-role client (used only by assignRole after the Admin gate) is
  // scripted with the same config so a successful privileged path can resolve.
  serviceClient = createFakeSupabase(config).client;
  return fake;
}

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

// ===========================================================================
// 401 vs 403 — the core authorization contract (Requirements 14.1, 14.2).
// ===========================================================================
describe("assertRole: 401 vs 403", () => {
  it("absent session → 401", async () => {
    setServer({ user: null, userError: { message: "no session" } });
    const { assertRole } = await import("@/lib/auth");
    const res = await assertRole(["ADMIN"]);
    expect(res).toEqual({ ok: false, status: 401 });
  });

  it("invalid/expired session (getUser error) → 401", async () => {
    setServer({ user: null, userError: { message: "JWT expired" } });
    const { assertRole } = await import("@/lib/auth");
    const res = await assertRole(["STAFF", "ADMIN"]);
    expect(res).toEqual({ ok: false, status: 401 });
  });

  it("verified session but no readable profile → treated as unauthenticated (401)", async () => {
    setServer({ user: { id: "u" }, tables: sessionTables(null) });
    const { assertRole } = await import("@/lib/auth");
    const res = await assertRole(["USER", "STAFF", "ADMIN"]);
    expect(res).toEqual({ ok: false, status: 401 });
  });

  it("valid session, role NOT in the allow-list → 403", async () => {
    setServer({ user: { id: "u" }, tables: sessionTables("USER") });
    const { assertRole } = await import("@/lib/auth");
    const res = await assertRole(["ADMIN"]);
    expect(res).toEqual({ ok: false, status: 403 });
  });

  it("valid session, role allowed → ok with userId + role", async () => {
    setServer({ user: { id: "u-123" }, tables: sessionTables("ADMIN") });
    const { assertRole } = await import("@/lib/auth");
    const res = await assertRole(["ADMIN"]);
    expect(res).toEqual({ ok: true, userId: "u-123", role: "ADMIN" });
  });
});

describe("domain functions map auth failures to 401/403", () => {
  it("listInquiries: USER → 403, no session → 401", async () => {
    setServer({ user: { id: "u" }, tables: sessionTables("USER") });
    let mod = await import("@/lib/inquiries");
    expect((await mod.listInquiries()).status).toBe(403);

    vi.resetModules();
    setServer({ user: null, userError: { message: "x" }, tables: sessionTables(null) });
    mod = await import("@/lib/inquiries");
    expect((await mod.listInquiries()).status).toBe(401);
  });

  it("assignRole (Admin-only): STAFF → 403, no session → 401", async () => {
    setServer({ user: { id: "s" }, tables: sessionTables("STAFF") });
    let mod = await import("@/lib/admin-users");
    expect((await mod.assignRole("u", "STAFF")).status).toBe(403);

    vi.resetModules();
    setServer({ user: null, userError: { message: "x" }, tables: sessionTables(null) });
    mod = await import("@/lib/admin-users");
    expect((await mod.assignRole("u", "STAFF")).status).toBe(401);
  });

  it("createListing (Admin-only): STAFF → 403", async () => {
    setServer({ user: { id: "s" }, tables: sessionTables("STAFF") });
    const { createListing } = await import("@/lib/listings");
    const res = await createListing({ title: "x" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(403);
  });

  it("submitMembershipReceipt: unauthenticated → 401", async () => {
    setServer({ user: null, userError: { message: "x" }, tables: sessionTables(null) });
    const { submitMembershipReceipt } = await import("@/lib/membership");
    const res = await submitMembershipReceipt(makeFakeFile({ type: "image/png" }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(401);
  });
});

// ===========================================================================
// Input-validation paths (Requirements 4.2/4.5, 9.2/9.10, 11.x, 13.x, 12.2).
// ===========================================================================
describe("inquiry submission validation (field-level 400s)", () => {
  async function post(body: unknown) {
    const { POST } = await import("@/app/api/inquiries/route");
    return POST(
      new Request("http://test/api/inquiries", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  }

  it("missing name / bad email / empty details → 400 with field errors and no insert", async () => {
    const fake = setServer({
      user: null,
      userError: { message: "anon" },
      tables: {
        ...sessionTables(null),
        listings: { select: { data: { id: "l", is_published: true }, error: null } },
      },
    });
    const res = await post({ listingId: "l", name: "", email: "nope", details: "" });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { fieldErrors?: Record<string, string> };
    expect(json.fieldErrors?.name).toBeTruthy();
    expect(json.fieldErrors?.email).toBeTruthy();
    expect(json.fieldErrors?.details).toBeTruthy();
    expect(fake.calls.fromCalls).not.toContain("inquiries");
  });

  it("malformed JSON body → 400", async () => {
    setServer({ tables: {} });
    const { POST } = await import("@/app/api/inquiries/route");
    const res = await POST(
      new Request("http://test/api/inquiries", { method: "POST", body: "not json" }),
    );
    expect(res.status).toBe(400);
  });

  it("valid fields but missing listingId → 400", async () => {
    setServer({
      user: null,
      userError: { message: "anon" },
      tables: { ...sessionTables(null) },
    });
    const res = await post({ name: "Jo", email: "jo@example.com", details: "Hello" });
    expect(res.status).toBe(400);
  });
});

describe("validation helpers", () => {
  it("isValidEmail accepts well-formed and rejects malformed", async () => {
    const { isValidEmail, isNonEmpty, sanitizeText } = await import("@/lib/validation");
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("no-at")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("")).toBe(false);
    expect(isNonEmpty("  x ")).toBe(true);
    expect(isNonEmpty("   ")).toBe(false);
    // sanitizeText strips angle brackets (stored-XSS defense).
    expect(sanitizeText("<script>hi")).toBe("scripthi");
  });
});

describe("donation validation (amount + file)", () => {
  it("amount <= 0 → 400 before any upload", async () => {
    const fake = setServer({ tables: {} });
    const { submitDonation } = await import("@/lib/donations");
    const res = await submitDonation({ amount: 0, file: makeFakeFile({}) });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(400);
    expect(fake.calls.uploadCalls.length).toBe(0);
  });

  it("missing file → 400", async () => {
    setServer({ tables: {} });
    const { submitDonation } = await import("@/lib/donations");
    const res = await submitDonation({ amount: 100, file: null });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(400);
  });

  it("disallowed content type → 400", async () => {
    setServer({ tables: {} });
    const { submitDonation } = await import("@/lib/donations");
    const res = await submitDonation({
      amount: 100,
      file: makeFakeFile({ type: "text/html" }),
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(400);
  });

  it("oversize file → 400", async () => {
    setServer({ tables: {} });
    const { submitDonation } = await import("@/lib/donations");
    const res = await submitDonation({
      amount: 100,
      file: makeFakeFile({ type: "image/png", size: 11 * 1024 * 1024 }),
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(400);
  });
});

describe("listing + role + status input validation", () => {
  it("createListing: non-/images/ image_url → 400", async () => {
    setServer({ user: { id: "a" }, tables: sessionTables("ADMIN") });
    const { createListing } = await import("@/lib/listings");
    const res = await createListing({
      title: "T",
      category: "CONSULTING",
      description: "D",
      inquiry_type: "DEMO",
      image_url: "https://evil/x.png",
      is_published: true,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(400);
  });

  it("assignRole: invalid role → 400 (Admin session)", async () => {
    setServer({ user: { id: "a" }, tables: sessionTables("ADMIN") });
    const { assignRole } = await import("@/lib/admin-users");
    const res = await assignRole("u", "SUPERUSER");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(400);
  });

  it("updateInquiry: invalid status → 400 (Staff session)", async () => {
    setServer({ user: { id: "s" }, tables: sessionTables("STAFF") });
    const { updateInquiry } = await import("@/lib/inquiries");
    const res = await updateInquiry("i", { status: "BOGUS" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(400);
  });

  it("rejectDonation: empty reason → 400 (Staff session, PENDING)", async () => {
    setServer({
      user: { id: "s" },
      tables: {
        ...sessionTables("STAFF"),
        donations: { select: { data: { id: "d", status: "PENDING" }, error: null } },
      },
    });
    const { rejectDonation } = await import("@/lib/donations");
    const res = await rejectDonation("d", "   ");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(400);
  });
});

// ===========================================================================
// Review 409-on-non-PENDING (Requirements 8.6, 9.9; Property 5).
// ===========================================================================
describe("review is terminal and single (409 on non-PENDING)", () => {
  it("rejectReceipt on an already-reviewed receipt → 409", async () => {
    setServer({
      user: { id: "s" },
      tables: {
        ...sessionTables("STAFF"),
        membership_receipts: {
          select: { data: { id: "r", status: "APPROVED" }, error: null },
        },
      },
    });
    const { rejectReceipt } = await import("@/lib/membership");
    const res = await rejectReceipt("r", "duplicate");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(409);
  });

  it("approveReceipt maps the 23505 SQLSTATE from approve_receipt() to 409", async () => {
    setServer({
      user: { id: "s" },
      tables: sessionTables("STAFF"),
      rpc: { approve_receipt: { data: null, error: { code: "23505" } } },
    });
    const { approveReceipt } = await import("@/lib/membership");
    const res = await approveReceipt("r");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(409);
  });

  it("approveReceipt maps P0002 → 404 and 42501 → 403", async () => {
    setServer({
      user: { id: "s" },
      tables: sessionTables("STAFF"),
      rpc: { approve_receipt: { data: null, error: { code: "P0002" } } },
    });
    let mod = await import("@/lib/membership");
    expect((await mod.approveReceipt("r")).status).toBe(404);

    vi.resetModules();
    setServer({
      user: { id: "s" },
      tables: sessionTables("STAFF"),
      rpc: { approve_receipt: { data: null, error: { code: "42501" } } },
    });
    mod = await import("@/lib/membership");
    expect((await mod.approveReceipt("r")).status).toBe(403);
  });

  it("verifyDonation on a non-PENDING donation → 409; on a missing one → 404", async () => {
    setServer({
      user: { id: "s" },
      tables: {
        ...sessionTables("STAFF"),
        donations: { select: { data: { id: "d", status: "VERIFIED" }, error: null } },
      },
    });
    let mod = await import("@/lib/donations");
    expect((await mod.verifyDonation("d")).status).toBe(409);

    vi.resetModules();
    setServer({
      user: { id: "s" },
      tables: {
        ...sessionTables("STAFF"),
        donations: { select: { data: null, error: null } },
      },
    });
    mod = await import("@/lib/donations");
    expect((await mod.verifyDonation("d")).status).toBe(404);
  });
});
