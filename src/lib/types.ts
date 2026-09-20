/** Domain types for the maintenance desk. No React in this folder, on purpose:
 *  everything here is a pure function or a plain type, so it can be tested
 *  without a renderer and reasoned about without one. */

export type Priority = 'emergency' | 'urgent' | 'routine';

export const PRIORITIES: Priority[] = ['emergency', 'urgent', 'routine'];

export type Status = 'new' | 'triaged' | 'scheduled' | 'in_progress' | 'done' | 'cancelled';

export const STATUSES: Status[] = ['new', 'triaged', 'scheduled', 'in_progress', 'done', 'cancelled'];

/** A request stops ageing once it reaches one of these. */
export const CLOSED_STATUSES: Status[] = ['done', 'cancelled'];

export type Category =
  | 'plumbing' | 'electrical' | 'heating' | 'appliance' | 'structural' | 'pest' | 'common_area' | 'other';

export const CATEGORIES: Category[] = [
  'plumbing', 'electrical', 'heating', 'appliance', 'structural', 'pest', 'common_area', 'other',
];

export interface Property { id: string; name: string; city: string; unitCount: number; }
export interface Unit { id: string; propertyId: string; label: string; }
export interface Tenant { id: string; unitId: string; name: string; phone: string; }
export interface Contractor { id: string; name: string; trade: Category; phone: string; }

export type EventKind =
  | 'opened' | 'triaged' | 'assigned' | 'unassigned' | 'scheduled' | 'rescheduled'
  | 'status_changed' | 'priority_changed' | 'note';

export interface RequestEvent {
  id: string;
  at: string;          // ISO
  kind: EventKind;
  by: string;
  note?: string;
}

export interface MaintenanceRequest {
  id: string;
  ref: string;             // human reference, e.g. "MR-1042"
  unitId: string;
  tenantId: string;
  title: string;
  detail: string;
  category: Category;
  priority: Priority;
  status: Status;
  createdAt: string;       // ISO
  updatedAt: string;       // ISO
  contractorId: string | null;
  scheduledFor: string | null;  // ISO date, no time
  events: RequestEvent[];
}

export interface Dataset {
  properties: Property[];
  units: Unit[];
  tenants: Tenant[];
  contractors: Contractor[];
  requests: MaintenanceRequest[];
}

export type Assignment = 'any' | 'assigned' | 'unassigned';

export type SortKey = 'ref' | 'property' | 'unit' | 'title' | 'priority' | 'status' | 'contractor' | 'age' | 'scheduledFor';

export interface Sort { key: SortKey; dir: 'asc' | 'desc'; }

export interface Filters {
  q: string;
  status: Status[];
  priority: Priority[];
  propertyId: string | null;
  assignment: Assignment;
  overdueOnly: boolean;
  /** Finished and cancelled work is hidden unless asked for. A queue that opens
   *  showing last month's completed jobs above this morning's is useless. An
   *  explicit status filter overrides this, so picking "done" still works. */
  includeClosed: boolean;
  sort: Sort;
  page: number;
}

export const DEFAULT_FILTERS: Filters = {
  q: '',
  status: [],
  priority: [],
  propertyId: null,
  assignment: 'any',
  overdueOnly: false,
  includeClosed: false,
  sort: { key: 'age', dir: 'desc' },
  page: 1,
};

export const PAGE_SIZE = 25;
