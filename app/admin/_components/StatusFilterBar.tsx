import Link from "next/link";

/**
 * StatusFilterBar — shared status-filter tabs for the review dashboards.
 *
 * Renders a row of links that set the `?status=` query on `basePath`. The
 * active filter is highlighted. Using links (not client state) keeps the
 * filtered list server-rendered through RLS on each navigation, and the
 * selected tab is shareable/bookmarkable. Styling is token-driven (ui.css).
 */
export function StatusFilterBar({
  basePath,
  current,
  filters,
}: {
  basePath: string;
  current: string;
  filters: readonly { value: string; label: string }[];
}) {
  return (
    <div className="filter-bar" role="tablist" aria-label="Filter by status">
      {filters.map((f) => {
        const active = f.value === current;
        const href =
          f.value === "ALL" ? basePath : `${basePath}?status=${f.value}`;
        return (
          <Link
            key={f.value}
            href={href}
            className={`filter-chip${active ? " filter-chip--active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {f.label}
          </Link>
        );
      })}
    </div>
  );
}
