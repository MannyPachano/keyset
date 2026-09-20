import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ApiError, fetchDataset, resetDataset, saveDataset } from '../api/mockApi.js';
import { initialState, reducer, type PendingMutation, type State } from '../lib/reducer.js';
import { buildIndex, toRow, type Row } from '../lib/query.js';
import type { Dataset, MaintenanceRequest } from '../lib/types.js';

export type LoadStatus = 'loading' | 'ready' | 'failed';

const EMPTY: Dataset = { properties: [], units: [], tenants: [], contractors: [], requests: [] };

let mutationSeq = 0;

export function useDataset(now: number) {
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [state, dispatch] = useReducer(reducer, EMPTY, initialState);
  const live = useRef<State>(state);
  live.current = state;

  const load = useCallback(async () => {
    setStatus('loading');
    setLoadError(null);
    try {
      const data = await fetchDataset();
      dispatch({ type: 'reset', data });
      setStatus('ready');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load the queue.');
      setStatus('failed');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /**
   * Applies a change to the rows straight away, then tries to save. A failure
   * puts back exactly what was there, which is why the previous rows travel
   * with the mutation instead of being refetched.
   */
  const mutate = useCallback(
    async (requestIds: string[], label: string, kind: PendingMutation['kind'], apply: (r: MaintenanceRequest) => MaintenanceRequest) => {
      if (!requestIds.length) return;
      const ids = new Set(requestIds);
      const previous = live.current.data.requests.filter((r) => ids.has(r.id)).map((r) => ({ ...r }));
      const mutation: PendingMutation = { id: `m${++mutationSeq}`, kind, requestIds, previous, label };

      dispatch({ type: 'mutateStart', mutation, apply });

      // Read the post-dispatch value on the next tick so the saved set matches
      // what is on screen rather than what was there a moment ago.
      await Promise.resolve();
      const optimistic = {
        ...live.current.data,
        requests: live.current.data.requests.map((r) => (ids.has(r.id) ? apply(previous.find((p) => p.id === r.id) ?? r) : r)),
      };

      try {
        await saveDataset(optimistic);
        dispatch({ type: 'mutateOk', id: mutation.id });
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'That change could not be saved.';
        dispatch({ type: 'mutateFail', id: mutation.id, message });
      }
    },
    [],
  );

  const reset = useCallback(async () => {
    setStatus('loading');
    try {
      const data = await resetDataset();
      dispatch({ type: 'reset', data });
      setStatus('ready');
    } catch {
      setStatus('failed');
      setLoadError('Could not reset the demo data.');
    }
  }, []);

  const index = useMemo(() => buildIndex(state.data), [state.data]);
  const rows: Row[] = useMemo(
    () => state.data.requests.map((r) => toRow(r, index, now)),
    [state.data.requests, index, now],
  );

  return { status, loadError, state, dispatch, rows, index, mutate, reset, reload: load };
}
