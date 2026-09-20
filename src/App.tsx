import { useCallback, useMemo, useState, type MouseEvent } from 'react';
import { getApiOptions, setApiOptions } from './api/mockApi.js';
import { mutations } from './lib/reducer.js';
import type { Priority, Status } from './lib/types.js';
import { Banner } from './components/Banner.js';
import { DetailPanel } from './components/DetailPanel.js';
import { QueueView } from './components/QueueView.js';
import { WeekBoard } from './components/WeekBoard.js';
import { useDataset } from './state/useDataset.js';
import { useUrlState } from './state/useUrlState.js';

const OPERATOR = 'Dana Whitfield';

export function App() {
  // Frozen for the life of the session so ages do not creep while you read.
  const [now] = useState(() => Date.now());
  const { status, loadError, state, dispatch, rows, index, mutate, reset, reload } = useDataset(now);
  const { filters, openId, view, setFilters, setPage, setOpenId, setView } = useUrlState();
  const [failing, setFailing] = useState(getApiOptions().failureRate > 0);

  const busy = state.pending.length > 0;
  const selectedIds = useMemo(() => [...state.selected], [state.selected]);

  const onSelect = useCallback(
    (id: string, event: MouseEvent, visibleIds: string[]) => {
      if (event.shiftKey) dispatch({ type: 'selectRange', id, visibleIds });
      else dispatch({ type: 'select', id, mode: 'toggle' });
    },
    [dispatch],
  );

  const runBulk = useCallback(
    (label: string, kind: 'status' | 'priority' | 'assign', apply: Parameters<typeof mutate>[3]) => {
      void mutate(selectedIds, label, kind, apply);
    },
    [mutate, selectedIds],
  );

  const at = () => new Date().toISOString();

  const openRow = useMemo(() => rows.find((r) => r.request.id === openId) ?? null, [rows, openId]);

  /** The panel acts on one request; the bulk bar acts on the selection. Same
   *  path through the same reducer, so optimism and rollback behave the same. */
  const one = useCallback(
    (label: string, kind: 'status' | 'priority' | 'assign' | 'schedule' | 'note', apply: Parameters<typeof mutate>[3]) => {
      if (openId) void mutate([openId], label, kind, apply);
    },
    [mutate, openId],
  );

  const toggleFailures = () => {
    const next = !failing;
    setFailing(next);
    setApiOptions({ failureRate: next ? 1 : 0 });
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">Keyset</span>
          <span className="brand-sub">Maintenance desk</span>
        </div>

        <nav className="viewtabs" aria-label="Views">
          <button type="button" className="viewtab" aria-current={view === 'queue' ? 'page' : undefined} onClick={() => setView('queue')}>Queue</button>
          <button type="button" className="viewtab" aria-current={view === 'week' ? 'page' : undefined} onClick={() => setView('week')}>This week</button>
        </nav>

        <div className="topbar-actions">
          <button
            type="button"
            className="btn btn-quiet"
            aria-pressed={failing}
            onClick={toggleFailures}
            title="Force every save to fail, to show the error and rollback behaviour"
          >
            {failing ? 'Failures on' : 'Force failures'}
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => void reset()}>
            Reset demo
          </button>
          <ThemeToggle />
        </div>
      </header>

      <main className="main" id="main">
        {state.lastError && (
          <Banner tone="error" onDismiss={() => dispatch({ type: 'dismissError' })}>
            {state.lastError}
          </Banner>
        )}

        {status === 'failed' ? (
          <Banner tone="error" action={{ label: 'Try again', onClick: () => void reload() }}>
            {loadError ?? 'The queue could not be loaded.'}
          </Banner>
        ) : view === 'week' ? (
          <WeekBoard
            rows={rows}
            filters={filters}
            now={now}
            busy={busy}
            onOpen={setOpenId}
            onMove={(id, day) => void mutate([id], `Visit moved`, 'schedule', mutations.schedule(day, OPERATOR, at()))}
          />
        ) : (
          <QueueView
            rows={rows}
            properties={state.data.properties}
            contractors={state.data.contractors}
            filters={filters}
            openId={openId}
            selected={state.selected}
            lastResult={state.lastResult}
            onDismissResult={() => dispatch({ type: 'dismissResult' })}
            loading={status === 'loading'}
            busy={busy}
            onFilters={setFilters}
            onPage={setPage}
            onOpen={setOpenId}
            onSelect={onSelect}
            onSelectAll={(visibleIds) => dispatch({ type: 'selectAll', visibleIds })}
            onClearSelection={() => dispatch({ type: 'clearSelection' })}
            onBulkAssign={(contractorId) => {
              const name = state.data.contractors.find((c) => c.id === contractorId)?.name ?? '';
              runBulk(contractorId ? `Assigned to ${name}` : 'Contractor removed', 'assign',
                mutations.assign(contractorId, name, OPERATOR, at()));
            }}
            onBulkStatus={(s: Status) => runBulk(`Status set to ${s.replace('_', ' ')}`, 'status', mutations.status(s, OPERATOR, at()))}
            onBulkPriority={(p: Priority) => runBulk(`Priority set to ${p}`, 'priority', mutations.priority(p, OPERATOR, at()))}
          />
        )}
      </main>

      {openRow && (
        <DetailPanel
          row={openRow}
          index={index}
          contractors={state.data.contractors}
          busy={busy}
          onClose={() => setOpenId(null)}
          onStatus={(v) => one(`Status set to ${v.replace('_', ' ')}`, 'status', mutations.status(v, OPERATOR, at()))}
          onPriority={(v) => one(`Priority set to ${v}`, 'priority', mutations.priority(v, OPERATOR, at()))}
          onAssign={(id) => {
            const name = state.data.contractors.find((c) => c.id === id)?.name ?? '';
            one(id ? `Assigned to ${name}` : 'Contractor removed', 'assign', mutations.assign(id, name, OPERATOR, at()));
          }}
          onSchedule={(day) => one(day ? 'Visit booked' : 'Visit unbooked', 'schedule', mutations.schedule(day, OPERATOR, at()))}
          onNote={(text) => one('Note added', 'note', mutations.note(text, OPERATOR, at()))}
        />
      )}

      {/* Bulk results are announced here rather than shown as a toast that a
          screen reader would miss or read at the wrong moment. */}
      <p className="visually-hidden" role="status" aria-live="polite">{state.announcement}</p>
    </div>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<string>(() => document.documentElement.getAttribute('data-theme') ?? 'light');
  const flip = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('keyset.theme', next); } catch { /* blocked storage */ }
    setTheme(next);
  };
  return (
    <button type="button" className="btn btn-icon" onClick={flip} aria-label={`Switch to the ${theme === 'dark' ? 'light' : 'dark'} theme`}>
      {theme === 'dark' ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      )}
    </button>
  );
}
