import type { Priority, Status } from '../../lib/types.js';

const STATUS_LABEL: Record<Status, string> = {
  new: 'New',
  triaged: 'Triaged',
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  done: 'Done',
  cancelled: 'Cancelled',
};

const PRIORITY_LABEL: Record<Priority, string> = {
  emergency: 'Emergency',
  urgent: 'Urgent',
  routine: 'Routine',
};

export function StatusPill({ status }: { status: Status }) {
  return <span className={`pill pill-status pill-${status}`}>{STATUS_LABEL[status]}</span>;
}

/** The dot carries the same information as the colour, so the pill still reads
 *  correctly to anyone who cannot separate red from amber. */
export function PriorityPill({ priority }: { priority: Priority }) {
  return (
    <span className={`pill pill-priority pill-${priority}`}>
      <span className="pill-dot" aria-hidden="true" />
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

export { STATUS_LABEL, PRIORITY_LABEL };
