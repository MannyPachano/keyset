import { DEFAULT_FILTERS, PRIORITIES, STATUSES, type Assignment, type Filters,
         type Priority, type SortKey, type Status } from './types.js';

const SORT_KEYS: SortKey[] = ['ref', 'property', 'unit', 'title', 'priority', 'status', 'contractor', 'age', 'scheduledFor'];

/** Filters live in the query string, not in component state. A filtered view
 *  can then be bookmarked, pasted to a colleague, and survives a reload or a
 *  back button, which is the behaviour people expect from a list they have
 *  spent thirty seconds narrowing. */
export function filtersToParams(f: Filters, openId?: string | null): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set('q', f.q.trim());
  if (f.status.length) p.set('status', f.status.join(','));
  if (f.priority.length) p.set('priority', f.priority.join(','));
  if (f.propertyId) p.set('property', f.propertyId);
  if (f.assignment !== 'any') p.set('assign', f.assignment);
  if (f.overdueOnly) p.set('overdue', '1');
  if (f.includeClosed) p.set('closed', '1');
  if (f.sort.key !== DEFAULT_FILTERS.sort.key || f.sort.dir !== DEFAULT_FILTERS.sort.dir) {
    p.set('sort', f.sort.key);
    p.set('dir', f.sort.dir);
  }
  if (f.page > 1) p.set('page', String(f.page));
  if (openId) p.set('request', openId);
  return p;
}

/** Anything unrecognised is dropped rather than trusted. A hand-edited or
 *  truncated URL should land on a sane list, never on a crash or an empty page. */
export function paramsToFilters(p: URLSearchParams): Filters {
  const list = <T extends string>(key: string, allowed: T[]): T[] => {
    const raw = p.get(key);
    if (!raw) return [];
    const seen = new Set<T>();
    for (const v of raw.split(',')) {
      const t = v.trim() as T;
      if (allowed.includes(t)) seen.add(t);
    }
    return [...seen];
  };

  const sortKey = p.get('sort') as SortKey | null;
  const dir = p.get('dir');
  const page = Number.parseInt(p.get('page') ?? '', 10);
  const assign = p.get('assign');

  return {
    q: p.get('q') ?? '',
    status: list<Status>('status', STATUSES),
    priority: list<Priority>('priority', PRIORITIES),
    propertyId: p.get('property') || null,
    assignment: (assign === 'assigned' || assign === 'unassigned' ? assign : 'any') as Assignment,
    overdueOnly: p.get('overdue') === '1',
    includeClosed: p.get('closed') === '1',
    sort: {
      key: sortKey && SORT_KEYS.includes(sortKey) ? sortKey : DEFAULT_FILTERS.sort.key,
      dir: dir === 'asc' || dir === 'desc' ? dir : DEFAULT_FILTERS.sort.dir,
    },
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export function openIdFromParams(p: URLSearchParams): string | null {
  return p.get('request') || null;
}

/** True when nothing is narrowing the list. Drives which empty state to show:
 *  "no requests yet" is a different message from "nothing matches these filters",
 *  and showing the wrong one is the usual bug. */
export function isUnfiltered(f: Filters): boolean {
  return !f.q.trim() && !f.status.length && !f.priority.length
    && !f.propertyId && f.assignment === 'any' && !f.overdueOnly && !f.includeClosed;
}

export function toSearchString(f: Filters, openId?: string | null): string {
  const s = filtersToParams(f, openId).toString();
  return s ? `?${s}` : '';
}
