import type { Dataset, MaintenanceRequest, Priority, RequestEvent, Status } from './types.js';

/** A change the user asked for, applied to the list immediately and reconciled
 *  when the mock API answers. Keeping the previous rows means a failure can put
 *  them back exactly, rather than refetching and hoping. */
export interface PendingMutation {
  id: string;
  kind: 'status' | 'priority' | 'assign' | 'schedule' | 'note';
  requestIds: string[];
  previous: MaintenanceRequest[];
  label: string;
}

export interface State {
  data: Dataset;
  selected: Set<string>;
  /** The row a shift-click measures from. */
  anchorId: string | null;
  pending: PendingMutation[];
  lastError: string | null;
  /** Text handed to the live region, so bulk results are announced. */
  announcement: string;
  /** What the last successful change touched. A bulk action can move rows out
   *  of the view that triggered it, and rows silently disappearing is the most
   *  disorienting thing a queue can do. The view uses this to say so. */
  lastResult: { label: string; requestIds: string[] } | null;
}

export type Action =
  | { type: 'select'; id: string; mode: 'toggle' | 'only' }
  | { type: 'selectRange'; id: string; visibleIds: string[] }
  | { type: 'selectAll'; visibleIds: string[] }
  | { type: 'clearSelection' }
  | { type: 'mutateStart'; mutation: PendingMutation; apply: (r: MaintenanceRequest) => MaintenanceRequest }
  | { type: 'mutateOk'; id: string }
  | { type: 'mutateFail'; id: string; message: string }
  | { type: 'dismissError' }
  | { type: 'dismissResult' }
  | { type: 'reset'; data: Dataset };

export function initialState(data: Dataset): State {
  return { data, selected: new Set(), anchorId: null, pending: [], lastError: null, announcement: '', lastResult: null };
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'select': {
      if (action.mode === 'only') {
        return { ...state, selected: new Set([action.id]), anchorId: action.id };
      }
      const next = new Set(state.selected);
      next.has(action.id) ? next.delete(action.id) : next.add(action.id);
      return { ...state, selected: next, anchorId: action.id };
    }

    case 'selectRange': {
      // Shift-click with no anchor behaves like a plain click rather than
      // selecting everything, which is what people expect.
      if (!state.anchorId) return reducer(state, { type: 'select', id: action.id, mode: 'toggle' });
      const from = action.visibleIds.indexOf(state.anchorId);
      const to = action.visibleIds.indexOf(action.id);
      if (from === -1 || to === -1) return reducer(state, { type: 'select', id: action.id, mode: 'toggle' });
      const [lo, hi] = from < to ? [from, to] : [to, from];
      const next = new Set(state.selected);
      for (const id of action.visibleIds.slice(lo, hi + 1)) next.add(id);
      return { ...state, selected: next };
    }

    case 'selectAll': {
      const allSelected = action.visibleIds.length > 0 && action.visibleIds.every((id) => state.selected.has(id));
      const next = new Set(state.selected);
      for (const id of action.visibleIds) allSelected ? next.delete(id) : next.add(id);
      return { ...state, selected: next, anchorId: null };
    }

    case 'clearSelection':
      return { ...state, selected: new Set(), anchorId: null };

    case 'mutateStart': {
      const ids = new Set(action.mutation.requestIds);
      const requests = state.data.requests.map((r) => (ids.has(r.id) ? action.apply(r) : r));
      return {
        ...state,
        data: { ...state.data, requests },
        pending: [...state.pending, action.mutation],
        lastError: null,
        lastResult: null,
      };
    }

    case 'mutateOk': {
      const done = state.pending.find((m) => m.id === action.id);
      return {
        ...state,
        pending: state.pending.filter((m) => m.id !== action.id),
        announcement: done ? `${done.label}. ${count(done.requestIds.length)} updated.` : state.announcement,
        lastResult: done ? { label: done.label, requestIds: done.requestIds } : state.lastResult,
      };
    }

    case 'mutateFail': {
      const failed = state.pending.find((m) => m.id === action.id);
      if (!failed) return { ...state, lastError: action.message };
      // Put back exactly what was there before, not a refetch.
      const restore = new Map(failed.previous.map((r) => [r.id, r]));
      const requests = state.data.requests.map((r) => restore.get(r.id) ?? r);
      return {
        ...state,
        data: { ...state.data, requests },
        pending: state.pending.filter((m) => m.id !== action.id),
        lastError: action.message,
        announcement: `${failed.label} failed. ${count(failed.requestIds.length)} put back.`,
        lastResult: null,
      };
    }

    case 'dismissError':
      return { ...state, lastError: null };

    case 'dismissResult':
      return { ...state, lastResult: null };

    case 'reset':
      return initialState(action.data);

    default:
      return state;
  }
}

function count(n: number): string {
  return `${n} request${n === 1 ? '' : 's'}`;
}

/** Helpers that build the `apply` function for each kind of change, and append
 *  the matching event so the detail timeline stays truthful. */
export const mutations = {
  status: (status: Status, by: string, at: string) => (r: MaintenanceRequest): MaintenanceRequest => ({
    ...r, status, updatedAt: at,
    events: [...r.events, event(r, 'status_changed', by, at, status)],
  }),
  priority: (priority: Priority, by: string, at: string) => (r: MaintenanceRequest): MaintenanceRequest => ({
    ...r, priority, updatedAt: at,
    events: [...r.events, event(r, 'priority_changed', by, at, priority)],
  }),
  assign: (contractorId: string | null, name: string, by: string, at: string) => (r: MaintenanceRequest): MaintenanceRequest => ({
    ...r, contractorId, updatedAt: at,
    events: [...r.events, event(r, contractorId ? 'assigned' : 'unassigned', by, at, contractorId ? name : undefined)],
  }),
  note: (text: string, by: string, at: string) => (r: MaintenanceRequest): MaintenanceRequest => ({
    ...r, updatedAt: at,
    events: [...r.events, event(r, 'note', by, at, text)],
  }),
  schedule: (day: string | null, by: string, at: string) => (r: MaintenanceRequest): MaintenanceRequest => ({
    ...r, scheduledFor: day, updatedAt: at,
    status: day && r.status === 'triaged' ? 'scheduled' : r.status,
    events: [...r.events, event(r, r.scheduledFor ? 'rescheduled' : 'scheduled', by, at, day ?? undefined)],
  }),
};

function event(r: MaintenanceRequest, kind: RequestEvent['kind'], by: string, at: string, note?: string): RequestEvent {
  return { id: `${r.id}-e${r.events.length}`, at, kind, by, note };
}
