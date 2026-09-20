import { buildIndex, toRow, type Index, type Row } from '../lib/query.js';
import { DEFAULT_FILTERS, type Contractor, type Dataset, type Filters, type MaintenanceRequest, type Property } from '../lib/types.js';

export const NOW = Date.parse('2026-09-20T12:00:00.000Z');
export const DAY = 86_400_000;

export const properties: Property[] = [
  { id: 'p1', name: 'Ashgrove Court', city: 'Portland', unitCount: 2 },
  { id: 'p2', name: 'The Beckett', city: 'Salem', unitCount: 1 },
];

export const contractors: Contractor[] = [
  { id: 'c1', name: 'Halvorsen Plumbing', trade: 'plumbing', phone: '1' },
  { id: 'c2', name: 'Bright Line Electric', trade: 'electrical', phone: '2' },
];

export const base: Omit<Dataset, 'requests'> = {
  properties,
  units: [
    { id: 'u1', propertyId: 'p1', label: '1A' },
    { id: 'u2', propertyId: 'p1', label: '2B' },
    { id: 'u3', propertyId: 'p2', label: '4C' },
  ],
  tenants: [
    { id: 't1', unitId: 'u1', name: 'Dana Whitfield', phone: '3' },
    { id: 't2', unitId: 'u2', name: 'Marcus Okonkwo', phone: '4' },
    { id: 't3', unitId: 'u3', name: 'Priya Baranov', phone: '5' },
  ],
  contractors,
};

let n = 0;
export function make(over: Partial<MaintenanceRequest> = {}): MaintenanceRequest {
  n += 1;
  return {
    id: `r${n}`, ref: `MR-${1000 + n}`,
    unitId: 'u1', tenantId: 't1',
    title: 'Kitchen sink draining slowly',
    detail: 'Water backs up and takes about ten minutes to clear.',
    category: 'plumbing', priority: 'routine', status: 'new',
    createdAt: new Date(NOW - 2 * DAY).toISOString(),
    updatedAt: new Date(NOW - 2 * DAY).toISOString(),
    contractorId: null, scheduledFor: null,
    events: [{ id: 'e0', at: new Date(NOW - 2 * DAY).toISOString(), kind: 'opened', by: 'Dana Whitfield' }],
    ...over,
  };
}

export function rowsOf(requests: MaintenanceRequest[], now = NOW): Row[] {
  const ix = buildIndex({ ...base, requests });
  return requests.map((r) => toRow(r, ix, now));
}

export function indexOf(requests: MaintenanceRequest[] = []): Index {
  return buildIndex({ ...base, requests });
}

export const filters = (over: Partial<Filters> = {}): Filters => ({ ...DEFAULT_FILTERS, ...over });
