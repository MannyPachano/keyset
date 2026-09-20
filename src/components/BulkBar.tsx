import { useId } from 'react';
import { PRIORITIES, STATUSES, type Contractor, type Priority, type Status } from '../lib/types.js';
import { PRIORITY_LABEL, STATUS_LABEL } from './ui/Pill.js';

interface Props {
  count: number;
  contractors: Contractor[];
  busy: boolean;
  onAssign: (contractorId: string | null) => void;
  onStatus: (status: Status) => void;
  onPriority: (priority: Priority) => void;
  onClear: () => void;
}

/** Sits above the table only while something is selected. Every control resets
 *  itself after use, because a select that keeps showing the last thing you did
 *  reads as the current state of the selection, which it is not. */
export function BulkBar({ count, contractors, busy, onAssign, onStatus, onPriority, onClear }: Props) {
  const assignId = useId();
  const statusId = useId();
  const priorityId = useId();

  return (
    <div className="bulkbar" role="group" aria-label="Actions for the selected requests">
      <p className="bulkbar-count">
        <strong>{count}</strong> {count === 1 ? 'request' : 'requests'} selected
      </p>

      <div className="bulkbar-actions">
        <div className="field field-inline">
          <label htmlFor={assignId} className="visually-hidden">Assign a contractor to the selected requests</label>
          <select
            id={assignId}
            className="input input-sm"
            value=""
            disabled={busy}
            onChange={(e) => { const v = e.target.value; e.target.value = ''; onAssign(v === '__none' ? null : v); }}
          >
            <option value="" disabled>Assign to</option>
            {contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="__none">Remove the contractor</option>
          </select>
        </div>

        <div className="field field-inline">
          <label htmlFor={statusId} className="visually-hidden">Set the status of the selected requests</label>
          <select
            id={statusId}
            className="input input-sm"
            value=""
            disabled={busy}
            onChange={(e) => { const v = e.target.value as Status; e.target.value = ''; onStatus(v); }}
          >
            <option value="" disabled>Set status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>

        <div className="field field-inline">
          <label htmlFor={priorityId} className="visually-hidden">Set the priority of the selected requests</label>
          <select
            id={priorityId}
            className="input input-sm"
            value=""
            disabled={busy}
            onChange={(e) => { const v = e.target.value as Priority; e.target.value = ''; onPriority(v); }}
          >
            <option value="" disabled>Set priority</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
          </select>
        </div>

        <button type="button" className="btn btn-quiet" onClick={onClear}>Clear selection</button>
      </div>
    </div>
  );
}
