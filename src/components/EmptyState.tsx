interface Props {
  title: string;
  detail: string;
  action?: { label: string; onClick: () => void };
}

/** Deliberately a component with required copy rather than a default message.
 *  "No results" is never the right sentence: the reason the list is empty is
 *  what the reader needs, and it differs between an empty queue and a filter
 *  that matched nothing. */
export function EmptyState({ title, detail, action }: Props) {
  return (
    <div className="empty">
      <svg className="empty-mark" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
      </svg>
      <h2 className="empty-title">{title}</h2>
      <p className="empty-detail">{detail}</p>
      {action && (
        <button type="button" className="btn btn-primary" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
