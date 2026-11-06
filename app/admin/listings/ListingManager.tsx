"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import {
  Button,
  Card,
  EmptyState,
  Feedback,
  Field,
  StatusBadge,
  TextAreaField,
} from "@/app/_components/ui";
import type { DbListing } from "@/lib/listings";
import type { InquiryType, ListingCategory } from "@/content/listings";

/**
 * ListingManager — create / edit / publish listings (task 9.4, Requirement 15).
 *
 * Shows a "New listing" form and the existing listings. Each listing can be
 * edited inline and published/unpublished with one button. Writes go to
 * `/api/admin/listings` (create) and `/api/admin/listings/[id]` (edit +
 * publish toggle); all are Admin-guarded server-side. On success the server
 * data refreshes.
 *
 * Required states: EMPTY (no listings yet → the create form is the CTA), ERROR
 * (inline Feedback with the form/action as recovery; surfaces the field-level
 * validation message from the server, e.g. a bad /images/ path), INTERACTIVE
 * (buttons/fields disable while a request is in flight).
 */

const CATEGORIES: readonly ListingCategory[] = [
  "CONSULTING",
  "WEB_DEV",
  "CUSTOM_SOFTWARE",
];
const INQUIRY_TYPES: readonly InquiryType[] = ["DEMO", "QUOTE", "INQUIRE"];

type DraftForm = {
  title: string;
  category: ListingCategory;
  description: string;
  inquiry_type: InquiryType;
  image_url: string;
  is_published: boolean;
};

const EMPTY_DRAFT: DraftForm = {
  title: "",
  category: "CONSULTING",
  description: "",
  inquiry_type: "INQUIRE",
  image_url: "/images/",
  is_published: false,
};

export function ListingManager({ listings }: { listings: DbListing[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="stack-6">
      <Card>
        <div className="stack-3">
          <h2 className="card__title">New listing</h2>
          {creating ? (
            <ListingForm
              initial={EMPTY_DRAFT}
              submitLabel="Create listing"
              onCancel={() => setCreating(false)}
              onSubmit={async (draft) => {
                const res = await fetch("/api/admin/listings", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(draft),
                });
                if (res.ok) {
                  setCreating(false);
                  router.refresh();
                }
                return res;
              }}
            />
          ) : (
            <div>
              <Button onClick={() => setCreating(true)}>Add a listing</Button>
            </div>
          )}
        </div>
      </Card>

      {listings.length === 0 ? (
        <EmptyState title="No listings yet">
          Create your first catalog listing above. Published listings appear in
          the public catalog.
        </EmptyState>
      ) : (
        <ul className="review-list stack-5">
          {listings.map((listing) => (
            <li key={listing.id}>
              <ListingRow
                listing={listing}
                editing={editingId === listing.id}
                onEdit={() => setEditingId(listing.id)}
                onDoneEditing={() => setEditingId(null)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ListingRow({
  listing,
  editing,
  onEdit,
  onDoneEditing,
}: {
  listing: DbListing;
  editing: boolean;
  onEdit: () => void;
  onDoneEditing: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function togglePublish() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/listings/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_published: !listing.is_published }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(data?.error ?? "Could not update. Please try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not update. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="stack-3">
        <div className="review-card__head">
          <span className="cell-strong">{listing.title}</span>
          <StatusBadge status={listing.is_published ? "APPROVED" : "PENDING"} />
        </div>
        <div className="cell-muted">
          {listing.category} · {listing.inquiry_type} ·{" "}
          {listing.is_published ? "Published" : "Unpublished"}
        </div>

        {error ? <Feedback tone="error">{error}</Feedback> : null}

        {editing ? (
          <ListingForm
            initial={{
              title: listing.title,
              category: listing.category,
              description: listing.description,
              inquiry_type: listing.inquiry_type,
              image_url: listing.image_url,
              is_published: listing.is_published,
            }}
            submitLabel="Save changes"
            onCancel={onDoneEditing}
            onSubmit={async (draft) => {
              const res = await fetch(`/api/admin/listings/${listing.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(draft),
              });
              if (res.ok) {
                onDoneEditing();
                router.refresh();
              }
              return res;
            }}
          />
        ) : (
          <div className="cell-actions">
            <Button variant="secondary" size="sm" disabled={busy} onClick={onEdit}>
              Edit
            </Button>
            <Button size="sm" disabled={busy} onClick={() => void togglePublish()}>
              {busy
                ? "Working…"
                : listing.is_published
                  ? "Unpublish"
                  : "Publish"}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * ListingForm — create/edit form. `onSubmit` performs the request and returns
 * the Response so the form can surface a server-side field error (e.g. an
 * invalid /images/ path) without the parent duplicating error handling.
 */
function ListingForm({
  initial,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  initial: DraftForm;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (draft: DraftForm) => Promise<Response>;
}) {
  const [draft, setDraft] = useState<DraftForm>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uid = useId();

  function update<K extends keyof DraftForm>(key: K, value: DraftForm[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await onSubmit(draft);
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(data?.error ?? "Could not save. Please try again.");
      }
    } catch {
      setError("Could not save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack-4" onSubmit={handleSubmit} noValidate>
      <Field
        id={`title-${uid}`}
        label="Title"
        required
        value={draft.title}
        disabled={busy}
        onChange={(e) => update("title", e.target.value)}
      />

      <div className="field">
        <label className="field__label" htmlFor={`category-${uid}`}>
          Category
        </label>
        <select
          id={`category-${uid}`}
          className="field__control"
          value={draft.category}
          disabled={busy}
          onChange={(e) => update("category", e.target.value as ListingCategory)}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="field__label" htmlFor={`inquiry-${uid}`}>
          Inquiry type
        </label>
        <select
          id={`inquiry-${uid}`}
          className="field__control"
          value={draft.inquiry_type}
          disabled={busy}
          onChange={(e) => update("inquiry_type", e.target.value as InquiryType)}
        >
          {INQUIRY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <TextAreaField
        id={`description-${uid}`}
        label="Description"
        required
        rows={4}
        value={draft.description}
        disabled={busy}
        onChange={(e) => update("description", e.target.value)}
      />

      <Field
        id={`image-${uid}`}
        label="Image path"
        required
        hint="A site-relative path under /images/, e.g. /images/my-listing.png"
        value={draft.image_url}
        disabled={busy}
        onChange={(e) => update("image_url", e.target.value)}
      />

      <label className="checkbox-row" htmlFor={`published-${uid}`}>
        <input
          id={`published-${uid}`}
          type="checkbox"
          checked={draft.is_published}
          disabled={busy}
          onChange={(e) => update("is_published", e.target.checked)}
        />
        <span>Published (visible in the public catalog)</span>
      </label>

      {error ? <Feedback tone="error">{error}</Feedback> : null}

      <div className="cell-actions">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
