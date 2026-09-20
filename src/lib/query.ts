import { ageMs, isClosed, isOverdue, slaProgress } from './dates.js';
import { PAGE_SIZE, type Dataset, type Filters, type MaintenanceRequest, type Priority, type Sort } from './types.js';

/** Lookup tables built once, so filtering and sorting never do a linear scan
 *  per row. With 200 rows it would not matter; with 20,000 it would. */
export interface Index {
  unit: Map<string, { label: string; propertyId: string }>;
  property: Map<string, string>;
  tenant: Map<string, string>;
  contractor: Map<string, string>;
}

export function buildIndex(d: Dataset): Index {
  return {
    unit: new Map(d.units.map((u) => [u.id, { label: u.label, propertyId: u.propertyId }])),
    property: new Map(d.properties.map((p) => [p.id, p.name])),
    tenant: new Map(d.tenants.map((t) => [t.id, t.name])),
    contractor: new Map(d.contractors.map((c) => [c.id, c.name])),
  };
}

/** Everything a row needs to render or be compared, resolved once. */
export interface Row {
  request: MaintenanceRequest;
  propertyId: string;
  propertyName: string;
  unitLabel: string;
  tenantName: string;
  contractorName: string;
  ageMs: number;
  overdue: boolean;
  /** Fraction of the deadline used. 1 is exactly due, above 1 is late. */
  sla: number;
}

export function toRow(req: MaintenanceRequest, ix: Index, now: number): Row {
  const unit = ix.unit.get(req.unitId);
  const propertyId = unit?.propertyId ?? '';
  return {
    request: req,
    propertyId,
    propertyName: ix.property.get(propertyId) ?? '',
    unitLabel: unit?.label ?? '',
    tenantName: ix.tenant.get(req.tenantId) ?? '',
    contractorName: req.contractorId ? ix.contractor.get(req.contractorId) ?? '' : '',
    ageMs: ageMs(req, now),
    overdue: isOverdue(req, now),
    sla: slaProgress(req, now),
  };
}

/** Case-insensitive match across the fields someone would actually type into a
 *  search box: the reference, the unit, the tenant, the title and the trade. */
export function matchesQuery(row: Row, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    row.request.ref, row.request.title, row.request.category,
    row.unitLabel, row.propertyName, row.tenantName, row.contractorName,
  ].join(' ').toLowerCase();
  // Every whitespace-separated term must appear, so "beckett leak" narrows
  // rather than widening the way a naive OR would.
  return needle.split(/\s+/).every((term) => hay.includes(term));
}

export function applyFilters(rows: Row[], f: Filters): Row[] {
  return rows.filter((row) => {
    if (f.status.length) {
      // An explicit choice wins outright, including a choice of a closed status.
      if (!f.status.includes(row.request.status)) return false;
    } else if (!f.includeClosed && isClosed(row.request.status)) {
      return false;
    }
    if (f.priority.length && !f.priority.includes(row.request.priority)) return false;
    if (f.propertyId && row.propertyId !== f.propertyId) return false;
    if (f.assignment === 'assigned' && !row.request.contractorId) return false;
    if (f.assignment === 'unassigned' && row.request.contractorId) return false;
    if (f.overdueOnly && !row.overdue) return false;
    if (!matchesQuery(row, f.q)) return false;
    return true;
  });
}

const PRIORITY_RANK: Record<Priority, number> = { emergency: 0, urgent: 1, routine: 2 };

function compare(a: Row, b: Row, key: Sort['key']): number {
  switch (key) {
    case 'ref': return a.request.ref.localeCompare(b.request.ref);
    case 'property': return a.propertyName.localeCompare(b.propertyName) || a.unitLabel.localeCompare(b.unitLabel);
    case 'unit': return a.unitLabel.localeCompare(b.unitLabel);
    case 'title': return a.request.title.localeCompare(b.request.title);
    case 'priority': return PRIORITY_RANK[a.request.priority] - PRIORITY_RANK[b.request.priority];
    case 'status': return a.request.status.localeCompare(b.request.status);
    // Unassigned sorts last on the way up, because a blank is not a name.
    case 'contractor': {
      if (!a.contractorName !== !b.contractorName) return a.contractorName ? -1 : 1;
      return a.contractorName.localeCompare(b.contractorName);
    }
    case 'age': return a.ageMs - b.ageMs;
    case 'scheduledFor': {
      if (!a.request.scheduledFor !== !b.request.scheduledFor) return a.request.scheduledFor ? -1 : 1;
      return (a.request.scheduledFor ?? '').localeCompare(b.request.scheduledFor ?? '');
    }
    default: return 0;
  }
}

/** Stable: ties fall back to the reference, so re-sorting never shuffles rows
 *  that compare equal and the eye can follow a row across a sort. */
export function applySort(rows: Row[], sort: Sort): Row[] {
  const dir = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const c = compare(a, b, sort.key);
    return c !== 0 ? c * dir : a.request.ref.localeCompare(b.request.ref);
  });
}

export interface Page {
  rows: Row[];
  total: number;
  page: number;
  pageCount: number;
  from: number;
  to: number;
}

/** Clamps out-of-range pages rather than returning nothing, which is what
 *  happens when a filter shrinks the result set while you are on page 6. */
export function paginate(rows: Row[], page: number, size = PAGE_SIZE): Page {
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, page), pageCount);
  const start = (current - 1) * size;
  const slice = rows.slice(start, start + size);
  return {
    rows: slice,
    total,
    page: current,
    pageCount,
    from: total === 0 ? 0 : start + 1,
    to: start + slice.length,
  };
}

/** One call from raw data to the rows on screen. */
export function queryRows(all: Row[], f: Filters, size = PAGE_SIZE): Page {
  return paginate(applySort(applyFilters(all, f), f.sort), f.page, size);
}

/** Counts for the filter chips, computed against everything except the filter
 *  being counted, so a count never reads zero for the option you are looking at.
 *
 *  includeClosed is forced on here for the same reason. Clicking "Done"
 *  overrides the hide-closed rule, so the count has to be what that click would
 *  actually produce, not what the current view contains. */
export function statusCounts(rows: Row[], f: Filters): Record<string, number> {
  const base = applyFilters(rows, { ...f, status: [], includeClosed: true });
  const out: Record<string, number> = {};
  for (const row of base) out[row.request.status] = (out[row.request.status] ?? 0) + 1;
  return out;
}
