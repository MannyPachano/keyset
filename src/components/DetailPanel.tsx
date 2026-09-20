import { useEffect, useId, useRef, useState } from 'react';
import { formatAge } from '../lib/dates.js';
import type { Index, Row } from '../lib/query.js';
import { PRIORITIES, STATUSES, type Contractor, type Priority, type RequestEvent, type Status } from '../lib/types.js';
import { PRIORITY_LABEL, PriorityPill, STATUS_LABEL, StatusPill } from './ui/Pill.js';

interface Props {
  row: Row;
  index: Index;
  contractors: Contractor[];
  busy: boolean;
  onClose: () => void;
  onStatus: (status: Status) => void;
  onPriority: (priority: Priority) => void;
  onAssign: (contractorId: string | null) => void;
  onSchedule: (day: string | null) => void;
  onNote: (text: string) => void;
}

const EVENT_LABEL: Record<RequestEvent['kind'], string> = {
  opened: 'Opened by',
  triaged: 'Triaged by',
  assigned: 'Assigned by',
  unassigned: 'Contractor removed by',
  scheduled: 'Scheduled by',
  rescheduled: 'Rescheduled by',
  status_changed: 'Status changed by',
  priority_changed: 'Priority changed by',
  note: 'Note from',
};

export function DetailPanel(props: Props) {
  const { row, index, contractors, busy } = props;
  const r = row.request;
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [note, setNote] = useState('');

  /* Focus moves into the panel when it opens and goes back to the row that
     opened it when it closes. Without the second half, closing the panel drops
     a keyboard user at the top of the document and they have to tab back. */
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => {
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [r.id]);

  /* Escape closes, and Tab is kept inside the panel while it is open. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); props.onClose(); return; }
      if (e.key !== 'Tab' || !panel.current) return;
      const focusable = panel.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [props]);

  const submitNote = (e: React.FormEvent) => {
    e.preventDefault();
    const text = note.trim();
    if (!text) return;
    props.onNote(text);
    setNote('');
  };

  return (
    <>
      <div className="panel-scrim" onClick={props.onClose} aria-hidden="true" />
      <div className="panel" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panel}>
        <header className="panel-head">
          <div className="panel-heading">
            <p className="panel-ref">{r.ref}</p>
            <h2 className="panel-title" id={titleId}>{r.title}</h2>
          </div>
          <button type="button" className="btn btn-icon" onClick={props.onClose} data-autofocus aria-label="Close this request">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="panel-body">
          <div className="panel-pills">
            <PriorityPill priority={r.priority} />
            <StatusPill status={r.status} />
            {row.overdue && <span className="pill pill-emergency">Past due</span>}
          </div>

          <dl className="panel-facts">
            <div><dt>Property</dt><dd>{row.propertyName}</dd></div>
            <div><dt>Unit</dt><dd>{row.unitLabel}</dd></div>
            <div><dt>Tenant</dt><dd>{row.tenantName}</dd></div>
            <div><dt>Open for</dt><dd className={row.overdue ? 'is-overdue' : ''}>{formatAge(row.ageMs)}</dd></div>
          </dl>

          <p className="panel-detail">{r.detail}</p>

          <section className="panel-section">
            <h3 className="panel-section-title">Change this request</h3>
            <div className="panel-controls">
              <Control label="Status" value={r.status} disabled={busy} onChange={(v) => props.onStatus(v as Status)}
                options={STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />
              <Control label="Priority" value={r.priority} disabled={busy} onChange={(v) => props.onPriority(v as Priority)}
                options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))} />
              <Control label="Contractor" value={r.contractorId ?? ''} disabled={busy}
                onChange={(v) => props.onAssign(v || null)}
                options={[{ value: '', label: 'Not assigned' }, ...contractors.map((c) => ({ value: c.id, label: c.name }))]} />
              <DateControl label="Visit booked for" value={r.scheduledFor} disabled={busy} onChange={props.onSchedule} />
            </div>
          </section>

          <section className="panel-section">
            <h3 className="panel-section-title">History</h3>
            <ol className="timeline">
              {[...r.events].reverse().map((e) => (
                <li className="timeline-item" key={e.id}>
                  <span className={`timeline-dot timeline-dot-${e.kind}`} aria-hidden="true" />
                  <div>
                    <p className="timeline-what">
                      {EVENT_LABEL[e.kind]} <strong>{e.by}</strong>
                      {e.note && e.kind !== 'note' && <> to <strong>{humanise(e.note, index)}</strong></>}
                    </p>
                    {e.kind === 'note' && <p className="timeline-note">{e.note}</p>}
                    <p className="timeline-when">{new Date(e.at).toLocaleString()}</p>
                  </div>
                </li>
              ))}
            </ol>

            <form className="note-form" onSubmit={submitNote}>
              <label htmlFor={`${titleId}-note`} className="field-label">Add a note</label>
              <textarea
                id={`${titleId}-note`}
                className="input"
                rows={2}
                value={note}
                disabled={busy}
                placeholder="What did the tenant or the contractor say?"
                onChange={(e) => setNote(e.target.value)}
              />
              <button type="submit" className="btn btn-primary" disabled={busy || !note.trim()}>Add note</button>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}

/** Turns a stored id in an event note into the name a person would recognise. */
function humanise(note: string, index: Index): string {
  return index.contractor.get(note) ?? note.replace('_', ' ');
}

function Control({ label, value, options, disabled, onChange }: {
  label: string; value: string; disabled: boolean;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>{label}</label>
      <select id={id} className="input" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function DateControl({ label, value, disabled, onChange }: {
  label: string; value: string | null; disabled: boolean; onChange: (day: string | null) => void;
}) {
  const id = useId();
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>{label}</label>
      <input id={id} type="date" className="input" value={value ?? ''} disabled={disabled}
        onChange={(e) => onChange(e.target.value || null)} />
    </div>
  );
}
