import type { Page } from '../lib/query.js';

interface Props {
  page: Page;
  onChange: (page: number) => void;
}

export function Pagination({ page, onChange }: Props) {
  if (page.total === 0) return null;
  const { page: current, pageCount, from, to, total } = page;

  return (
    <nav className="pagination" aria-label="Queue pages">
      <p className="pagination-count">
        Showing <strong>{from}</strong> to <strong>{to}</strong> of <strong>{total}</strong>
      </p>
      <div className="pagination-controls">
        <button
          type="button"
          className="btn btn-quiet"
          onClick={() => onChange(current - 1)}
          disabled={current <= 1}
        >
          Previous
        </button>
        <span className="pagination-position" aria-current="page">
          Page {current} of {pageCount}
        </span>
        <button
          type="button"
          className="btn btn-quiet"
          onClick={() => onChange(current + 1)}
          disabled={current >= pageCount}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
