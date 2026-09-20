/** Rows sized like the real ones, so the page does not jump when data lands.
 *  aria-hidden plus a live message on the wrapper: a screen reader is told the
 *  queue is loading once, rather than reading out twelve grey bars. */
export function TableSkeleton({ rows = 12 }: { rows?: number }) {
  return (
    <div className="skeleton-wrap">
      <p className="visually-hidden" role="status">Loading the queue.</p>
      <div aria-hidden="true">
        {Array.from({ length: rows }, (_, i) => (
          <div className="skeleton-row" key={i}>
            <span className="skeleton-bar" style={{ width: '4rem' }} />
            <span className="skeleton-bar" style={{ width: '7rem' }} />
            <span className="skeleton-bar" style={{ width: `${40 + ((i * 7) % 30)}%` }} />
            <span className="skeleton-bar" style={{ width: '5rem' }} />
            <span className="skeleton-bar" style={{ width: '6rem' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
