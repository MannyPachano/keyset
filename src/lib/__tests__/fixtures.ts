import type { Dataset, MaintenanceRequest, Priority, Status } from '../types.js';
import { buildIndex, toRow, type Row } from '../query.js';

export const NOW = Date.parse('2026-09-20T12:00:00.000Z');
export const DAY = 86_400_000;

export const dataset: Dataset = {
  properties: [
    { id: 'p1', name: 'Ashgrove Court', city: 'Portland', unitCount: 2 },
    { id: 'p2', name: 'The Beckett', city: 'Salem', unitCount: 1 },
  ],
  units: [
    { id: 'u1', propertyId: 'p1', label: '1A' },
    { id: 'u2', propertyId: 'p1', label: '2B' },
    { id: 'u3', propertyId: 'p2', label: '4C' },
  ],
  tenants: [
    { id: 't1', unitId: 'u1', name: 'Dana Whitfield', phone: '1' },
    { id: 't2', unitId: 'u2', name: 'Marcus Okonkwo', phone: '2' },
    { id: 't3', unitId: 'u3', name: 'Priya Baranov', phone: '3' },
  ],
  contractors: [
    { id: 'c1', name: 'Halvorsen Plumbing', trade: 'plumbing', phone: '4' },
    { id: 'c2', name: 'Bright Line Electric', trade: 'electrical', phone: '5' },
  ],
  requests: [],
};

let n = 0;
export function make(over: Partial<MaintenanceRequest> = {}): MaintenanceRequest {
  n += 1;
  return {
    id: `r${n}`, ref: `MR-${1000 + n}`,
    unitId: 'u1', tenantId: 't1',
    title: 'Kitchen sink draining slowly', detail: '',
    category: 'plumbing',
    priority: 'routine' as Priority, status: 'new' as Status,
    createdAt: new Date(NOW - 2 * DAY).toISOString(),
    updatedAt: new Date(NOW - 2 * DAY).toISOString(),
    contractorId: null, scheduledFor: null, events: [],
    ...over,
  };
}

export function rowsOf(requests: MaintenanceRequest[], now = NOW): Row[] {
  const ix = buildIndex({ ...dataset, requests });
  return requests.map((r) => toRow(r, ix, now));
}
