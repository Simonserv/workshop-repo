"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, EmptyState, Feedback } from "@/app/_components/ui";
import type { DbProfile } from "@/lib/admin-users";
import type { Role } from "@/lib/auth";

/**
 * UserManager — interactive member/role table (task 9.5, Requirement 15).
 *
 * Each member row shows a role select and an Apply button; applying posts to
 * `/api/admin/users/[id]/role` and refreshes the server data so the new role is
 * reflected. The select tracks pending (unsaved) changes per row so an Admin
 * can see what they are about to apply.
 *
 * Required states: EMPTY (no members), ERROR (inline Feedback as recovery),
 * INTERACTIVE (select/button disable while a row request is in flight; Apply is
 * disabled until the role differs from the saved value).
 */

const ROLES: readonly Role[] = ["ADMIN", "STAFF", "USER"];

export function UserManager({ members }: { members: DbProfile[] }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, Role>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function draftFor(m: DbProfile): Role {
    return drafts[m.id] ?? m.role;
  }

  async function apply(m: DbProfile) {
    const role = draftFor(m);
    if (role === m.role) return;
    setBusyId(m.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${m.id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(data?.error ?? "Could not assign the role. Please try again.");
        return;
      }
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[m.id];
        return next;
      });
      router.refresh();
    } catch {
      setError("Could not assign the role. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  if (members.length === 0) {
    return (
      <EmptyState title="No members yet">
        Members appear here after they register. You can then assign Staff or
        Admin roles.
      </EmptyState>
    );
  }

  return (
    <div className="stack-5">
      {error ? <Feedback tone="error">{error}</Feedback> : null}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Member</th>
              <th scope="col">Membership</th>
              <th scope="col">Role</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const draft = draftFor(m);
              const busy = busyId === m.id;
              const changed = draft !== m.role;
              return (
                <tr key={m.id}>
                  <td className="cell-strong">{m.email ?? "(no email)"}</td>
                  <td>{m.membership_status === "MEMBER" ? "Member" : "—"}</td>
                  <td>
                    <label className="sr-only" htmlFor={`role-${m.id}`}>
                      Role for {m.email ?? m.id}
                    </label>
                    <select
                      id={`role-${m.id}`}
                      className="field__control select-inline"
                      value={draft}
                      disabled={busy}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [m.id]: e.target.value as Role,
                        }))
                      }
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <Button
                      size="sm"
                      disabled={busy || !changed}
                      onClick={() => void apply(m)}
                    >
                      {busy ? "Working…" : "Apply"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
