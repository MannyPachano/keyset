import { useCallback, useEffect, useMemo, useState, type DragEvent, type KeyboardEvent } from 'react';
import { addDays, groupByDay, isoDay, startOfWeek, weekDays } from '../lib/dates.js';
import { applyFilters, type Row } from '../lib/query.js';
import type { Filters } from '../lib/types.js';
import { EmptyState } from './EmptyState.js';
import { PriorityPill } from './ui/Pill.js';

interface Props {
  rows: Row[];
  filters: Filters;
  now: number;
  busy: boolean;
  onMove: (requestId: string, day: string) => void;
  onOpen: (id: string) => void;
}

/** A day with more than this many visits is more than a crew can do, so it is
 *  flagged rather than silently accepted. */
const BUSY_DAY = 8;

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function WeekBoard({ rows, filters, now, busy, onMove, onOpen }: Props) {
  const [anchor, setAnchor] = useState(() => startOfWeek(isoDay(new Date(now))));
  const days = useMemo(() => weekDays(anchor), [anchor]);

  /* Keyboard equivalent of the drag. Space or Enter picks a card up, the arrow
     keys move it between days, Space or Enter drops it, Escape puts it back.
     Drag alone is unusable without a mouse, and a board where the only way to
     reschedule is dragging excludes people for no reason. */
  const [grabbed, setGrabbed] = useState<{ id: string; from: string; target: string } | null>(null);
  const [message, setMessage] = useState('');

  const scheduled = useMemo(() => {
    const filtered = applyFilters(rows, { ...filters, page: 1 });
    return filtered.map((r) => r.request);
  }, [rows, filters]);

  const byDay = useMemo(() => groupByDay(scheduled, days), [scheduled, days]);
  const rowById = useMemo(() => new Map(rows.map((r) => [r.request.id, r])), [rows]);
  const total = days.reduce((n, d) => n + byDay[d].length, 0);

  const drop = useCallback((id: string, day: string) => {
    onMove(id, day);
    setMessage(`Moved to ${formatDay(day)}.`);
  }, [onMove]);

  const onCardKey = useCallback((e: KeyboardEvent<HTMLElement>, id: string, day: string) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!grabbed) {
        setGrabbed({ id, from: day, target: day });
        setMessage(`Picked up. Use the left and right arrow keys to choose a day, then press Enter to drop, or Escape to put it back.`);
      } else {
        if (grabbed.target !== grabbed.from) drop(grabbed.id, grabbed.target);
        else setMessage('Put back where it was.');
        setGrabbed(null);
      }
      return;
    }
    if (!grabbed) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      setGrabbed(null);
      setMessage('Cancelled, left where it was.');
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const at = days.indexOf(grabbed.target);
      const next = days[Math.min(days.length - 1, Math.max(0, at + (e.key === 'ArrowRight' ? 1 : -1)))];
      if (next !== grabbed.target) {
        setGrabbed({ ...grabbed, target: next });
        setMessage(`${formatDay(next)}, ${byDay[next].length} already booked.`);
      }
    }
  }, [grabbed, days, byDay, drop]);

  // A grabbed card that is dropped or filtered away should not leave the board
  // stuck in a picked-up state with nothing to put down.
  useEffect(() => {
    if (grabbed && !scheduled.some((r) => r.id === grabbed.id)) setGrabbed(null);
  }, [grabbed, scheduled]);

  const shift = (weeks: number) => { setAnchor((a) => addDays(a, weeks * 7)); setGrabbed(null); };
  const thisWeek = startOfWeek(isoDay(new Date(now)));

  return (
    <div className="board">
      <div className="board-head">
        <div className="board-nav">
          <button type="button" className="btn btn-quiet" onClick={() => shift(-1)}>Previous week</button>
          <button type="button" className="btn btn-quiet" onClick={() => setAnchor(thisWeek)} disabled={anchor === thisWeek}>
            This week
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => shift(1)}>Next week</button>
        </div>
        <p className="board-range">
          {formatDay(days[0])} to {formatDay(days[6])} &middot; <strong>{total}</strong> {total === 1 ? 'visit' : 'visits'}
        </p>
      </div>

      {total === 0 ? (
        <EmptyState
          title="No visits booked this week"
          detail="Nothing is scheduled between these dates that matches your filters. Try another week, or widen the filters."
        />
      ) : (
        <div className="board-grid">
          {days.map((day) => {
            const items = byDay[day];
            const isTarget = grabbed?.target === day;
            return (
              <section
                key={day}
                className={`board-day${isTarget ? ' is-target' : ''}${day === isoDay(new Date(now)) ? ' is-today' : ''}`}
                onDragOver={(e: DragEvent) => { e.preventDefault(); }}
                onDrop={(e: DragEvent) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) drop(id, day); }}
                aria-label={`${formatDay(day)}, ${items.length} ${items.length === 1 ? 'visit' : 'visits'}`}
              >
                <header className="board-day-head">
                  <span className="board-day-name">{DAY_NAMES[days.indexOf(day)]}</span>
                  <span className="board-day-date">{formatDay(day)}</span>
                  <span className={`board-day-count${items.length > BUSY_DAY ? ' is-busy' : ''}`}>
                    {items.length}
                    {items.length > BUSY_DAY && <span className="visually-hidden">, more than a crew can fit in a day</span>}
                  </span>
                </header>

                <ul className="board-cards">
                  {items.map((req) => {
                    const row = rowById.get(req.id);
                    const isGrabbed = grabbed?.id === req.id;
                    return (
                      <li key={req.id}>
                        <div
                          className={`board-card${isGrabbed ? ' is-grabbed' : ''}`}
                          draggable={!busy}
                          tabIndex={0}
                          role="button"
                          aria-roledescription="Draggable visit. Press Enter to pick it up."
                          aria-grabbed={isGrabbed || undefined}
                          onDragStart={(e: DragEvent) => e.dataTransfer.setData('text/plain', req.id)}
                          onKeyDown={(e) => onCardKey(e, req.id, day)}
                          onDoubleClick={() => onOpen(req.id)}
                        >
                          <div className="board-card-top">
                            <button type="button" className="ref-link" data-ref-for={req.id} onClick={() => onOpen(req.id)}>{req.ref}</button>
                            <PriorityPill priority={req.priority} />
                          </div>
                          <p className="board-card-title">{req.title}</p>
                          <p className="board-card-sub">
                            {row?.propertyName} &middot; Unit {row?.unitLabel}
                          </p>
                          <p className="board-card-sub">{row?.contractorName || 'Not assigned'}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <p className="visually-hidden" role="status" aria-live="assertive">{message}</p>
    </div>
  );
}

function formatDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
