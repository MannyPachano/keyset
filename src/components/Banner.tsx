interface Props {
  tone: 'error' | 'info';
  children: React.ReactNode;
  onDismiss?: () => void;
  action?: { label: string; onClick: () => void };
}

export function Banner({ tone, children, onDismiss, action }: Props) {
  return (
    <div className={`banner banner-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <p className="banner-text">{children}</p>
      <div className="banner-actions">
        {action && (
          <button type="button" className="btn btn-quiet" onClick={action.onClick}>
            {action.label}
          </button>
        )}
        {onDismiss && (
          <button type="button" className="btn btn-icon" onClick={onDismiss} aria-label="Dismiss this message">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
