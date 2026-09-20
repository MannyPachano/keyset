import { CLOSED_STATUSES, type MaintenanceRequest, type Priority, type Status } from './types.js';

const HOUR = 3600_000;
const DAY = 24 * HOUR;

/** How long a request of this priority may sit before it is late.
 *  These are the numbers a property manager argues about, so they live in one
 *  place rather than being scattered through the components. */
export const SLA_MS: Record<Priority, number> = {
  emergency: 4 * HOUR,
  urgent: 2 * DAY,
  routine: 7 * DAY,
};

/** Milliseconds a request has been open. Closed requests freeze at the moment
 *  they closed, so a job finished last year does not keep ageing. */
export function ageMs(req: MaintenanceRequest, now: number): number {
  const opened = Date.parse(req.createdAt);
  const end = isClosed(req.status) ? Date.parse(req.updatedAt) : now;
  return Math.max(0, end - opened);
}

export function isClosed(status: Status): boolean {
  return CLOSED_STATUSES.includes(status);
}

export function isOverdue(req: MaintenanceRequest, now: number): boolean {
  if (isClosed(req.status)) return false;
  return ageMs(req, now) > SLA_MS[req.priority];
}

/** How far past the deadline, as a fraction. 0 means just opened, 1 means the
 *  deadline is exactly now, above 1 is late. Drives the urgency bar. */
export function slaProgress(req: MaintenanceRequest, now: number): number {
  if (isClosed(req.status)) return 0;
  return ageMs(req, now) / SLA_MS[req.priority];
}

/** "3 days", "4 hours", "12 minutes". Deliberately coarse: nobody needs seconds. */
export function formatAge(ms: number): string {
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.floor(hours / 24);
  if (days < 28) return `${days} day${days === 1 ? '' : 's'}`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? '' : 's'}`;
}

/** Local calendar day as YYYY-MM-DD, without dragging in a date library. */
export function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return isoDay(new Date(y, m - 1, d + n));
}

/** The Monday on or before the given day. The week board starts here. */
export function startOfWeek(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const shift = (date.getDay() + 6) % 7; // Sunday is 0, we want Monday first
  return addDays(day, -shift);
}

export function weekDays(day: string): string[] {
  const start = startOfWeek(day);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Groups scheduled requests by the day they are booked for. Every day in the
 *  week is present, even the empty ones, so the board never collapses. */
export function groupByDay(requests: MaintenanceRequest[], days: string[]): Record<string, MaintenanceRequest[]> {
  const out: Record<string, MaintenanceRequest[]> = {};
  for (const d of days) out[d] = [];
  for (const r of requests) {
    if (r.scheduledFor && out[r.scheduledFor]) out[r.scheduledFor].push(r);
  }
  return out;
}
