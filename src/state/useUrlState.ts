import { useCallback, useEffect, useState } from 'react';
import { filtersToParams, openIdFromParams, paramsToFilters, viewFromParams, type View } from '../lib/url.js';
import type { Filters } from '../lib/types.js';

/**
 * Filters and the open request live in the query string, not in component
 * state. One page, one screen's worth of state, so this uses the History API
 * directly rather than pulling in a router: the back button, a bookmark and a
 * pasted link all work, and there is one less dependency to keep current.
 */

interface UrlState {
  filters: Filters;
  openId: string | null;
  view: View;
}

function read(): UrlState {
  const params = new URLSearchParams(window.location.search);
  return { filters: paramsToFilters(params), openId: openIdFromParams(params), view: viewFromParams(params) };
}

function write(next: UrlState, replace: boolean): void {
  const qs = filtersToParams(next.filters, next.openId, next.view).toString();
  const url = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
  if (replace) window.history.replaceState(null, '', url);
  else window.history.pushState(null, '', url);
}

export function useUrlState() {
  const [state, setState] = useState<UrlState>(read);

  // The back and forward buttons are a real navigation here, so listen for them.
  useEffect(() => {
    const onPop = () => setState(read());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  /** Changing a filter replaces the entry. Twenty filter tweaks should not mean
   *  twenty presses of the back button to leave the page. */
  const setFilters = useCallback((update: Partial<Filters> | ((f: Filters) => Filters)) => {
    setState((prev) => {
      const filters = typeof update === 'function' ? update(prev.filters) : { ...prev.filters, ...update };
      // Any change to what is being shown sends you back to the first page,
      // except an explicit page change.
      const next: UrlState = {
        ...prev,
        filters: 'page' in (typeof update === 'function' ? {} : update) ? filters : { ...filters, page: 1 },
      };
      write(next, true);
      return next;
    });
  }, []);

  const setPage = useCallback((page: number) => {
    setState((prev) => {
      const next = { ...prev, filters: { ...prev.filters, page } };
      write(next, true);
      return next;
    });
  }, []);

  /** Opening a request is a navigation, so it does push. Escape or the back
   *  button then closes the panel, which is what people try first. */
  const setOpenId = useCallback((openId: string | null) => {
    setState((prev) => {
      if (prev.openId === openId) return prev;
      const next = { ...prev, openId };
      write(next, openId === null);
      return next;
    });
  }, []);

  /** Switching view is a navigation, so it pushes: the back button returns you
   *  to the list you came from, with the filters you had. */
  const setView = useCallback((view: View) => {
    setState((prev) => {
      if (prev.view === view) return prev;
      const next = { ...prev, view, openId: null };
      write(next, false);
      return next;
    });
  }, []);

  return { filters: state.filters, openId: state.openId, view: state.view, setFilters, setPage, setOpenId, setView };
}
