"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";

export function PaginatedItems<T>({ items, children, pageSize = 10, label = "records" }: {
  items: T[];
  children: (pageItems: T[]) => ReactNode;
  pageSize?: number;
  label?: string;
}) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  useEffect(() => setPage((current) => Math.min(current, pageCount)), [pageCount]);
  const pageItems = useMemo(() => items.slice((page - 1) * pageSize, page * pageSize), [items, page, pageSize]);
  const first = items.length ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(page * pageSize, items.length);

  return <>
    {children(pageItems)}
    {items.length > pageSize && <nav className="table-pagination" aria-label={`${label} pagination`}>
      <span>Showing {first}–{last} of {items.length} {label}</span>
      <div>
        <button type="button" className="button small" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
        <span aria-live="polite">Page {page} of {pageCount}</span>
        <button type="button" className="button small" disabled={page === pageCount} onClick={() => setPage((current) => current + 1)}>Next</button>
      </div>
    </nav>}
  </>;
}
