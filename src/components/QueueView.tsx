import { useCallback, useMemo, type MouseEvent } from 'react';
import { queryRows, statusCounts, applyFilters, type Row } from '../lib/query.js';
import { Banner } from './Banner.js';
import { DEFAULT_FILTERS, type Contractor, type Filters, type Priority, type Property, type SortKey, type Status } from '../lib/types.js';
import { isUnfiltered } from '../lib/url.js';
import { BulkBar } from './BulkBar.js';
import { EmptyState } from './EmptyState.js';
import { FilterBar } from './FilterBar.js';
import { Pagination } from './Pagination.js';
import { RequestTable } from './RequestTable.js';
import { TableSkeleton } from './Skeleton.js';

interface Props {
  rows: Row[];
  properties: Property[];
  contractors: Contractor[];
  filters: Filters;
  openId: string | null;
  selected: Set<string>;
  lastResult: { label: string; requestIds: string[] } | null;
  onDismissResult: () => void;
  loading: boolean;
  busy: boolean;
  onFilters: (next: Partial<Filters>) => void;
  onPage: (page: number) => void;
  onOpen: (id: string) => void;
  onSelect: (id: string, event: MouseEvent, visibleIds: string[]) => void;
  onSelectAll: (visibleIds: string[]) => void;
  onClearSelection: () => void;
  onBulkAssign: (contractorId: string | null) => void;
  onBulkStatus: (status: Status) => void;
  onBulkPriority: (priority: Priority) => void;
}

export function QueueView(props: Props) {
  const { rows, filters, loading } = props;

  const page = useMemo(() => queryRows(rows, filters), [rows, filters]);
  const counts = useMemo(() => statusCounts(rows, filters), [rows, filters]);
  const overdueCount = useMemo(
    () => applyFilters(rows, { ...filters, overdueOnly: true, page: 1 }).length,
    [rows, filters],
  );
  const visibleIds = useMemo(() => page.rows.map((r) => r.request.id), [page.rows]);

  /* A bulk action can push the rows it touched out of the view that triggered
     it: cancel four requests in the default view and they are closed, so they
     vanish. Saying so is the difference between "it worked" and "did that do
     anything". Recomputed live, so the message disappears by itself once the
     filters would show them again. */
  const matchingIds = useMemo(
    () => new Set(applyFilters(rows, { ...filters, page: 1 }).map((r) => r.request.id)),
    [rows, filters],
  );
  const movedOut = props.lastResult
    ? props.lastResult.requestIds.filter((id) => !matchingIds.has(id)).length
    : 0;

  const onSort = useCallback(
    (key: SortKey) => {
      const same = filters.sort.key === key;
      // Clicking a new column starts on the reading most people want first:
      // biggest number or latest date at the top, but names A to Z.
      const dir = same ? (filters.sort.dir === 'asc' ? 'desc' : 'asc') : (key === 'age' || key === 'priority' ? 'desc' : 'asc');
      props.onFilters({ sort: { key, dir } });
    },
    [filters.sort, props],
  );

  const selectedOnPage = props.selected.size;

  if (loading) {
    return (
      <div className="queue">
        <FilterBar
          filters={filters}
          properties={props.properties}
          statusCounts={counts}
          overdueCount={overdueCount}
          onChange={props.onFilters}
          onClear={() => props.onFilters(DEFAULT_FILTERS)}
        />
        <TableSkeleton />
      </div>
    );
  }

  return (
    <div className="queue">
      <FilterBar
        filters={filters}
        properties={props.properties}
        statusCounts={counts}
        overdueCount={overdueCount}
        onChange={props.onFilters}
        onClear={() => props.onFilters(DEFAULT_FILTERS)}
      />

      {movedOut > 0 && props.lastResult && (
        <Banner
          tone="info"
          onDismiss={props.onDismissResult}
          /* Clearing the filters alone would not do it: the default view still
             hides finished work, which is the most common reason a row leaves.
             This resets everything and turns closed work on, so the rows it
             promises to show are genuinely shown. */
          action={{ label: 'Show them', onClick: () => props.onFilters({ ...DEFAULT_FILTERS, includeClosed: true }) }}
        >
          {props.lastResult.label}.{' '}
          {movedOut === 1 ? 'One request no longer matches' : `${movedOut} requests no longer match`} the filters you are using,
          so {movedOut === 1 ? 'it has' : 'they have'} left this view.
        </Banner>
      )}

      {selectedOnPage > 0 && (
        <BulkBar
          count={selectedOnPage}
          contractors={props.contractors}
          busy={props.busy}
          onAssign={props.onBulkAssign}
          onStatus={props.onBulkStatus}
          onPriority={props.onBulkPriority}
          onClear={props.onClearSelection}
        />
      )}

      {page.total === 0 ? (
        isUnfiltered(filters) ? (
          <EmptyState
            title="Nothing in the queue"
            detail="No open maintenance requests. New ones from tenants will appear here."
          />
        ) : (
          <EmptyState
            title="No requests match these filters"
            detail="Nothing here fits what you have narrowed to. Widen a filter or clear them all to see the whole queue."
            action={{ label: 'Clear filters', onClick: () => props.onFilters(DEFAULT_FILTERS) }}
          />
        )
      ) : (
        <>
          <RequestTable
            page={page}
            sort={filters.sort}
            selected={props.selected}
            openId={props.openId}
            onSort={onSort}
            onSelect={(id, event) => props.onSelect(id, event, visibleIds)}
            onSelectAll={() => props.onSelectAll(visibleIds)}
            onOpen={props.onOpen}
          />
          <Pagination page={page} onChange={props.onPage} />
        </>
      )}
    </div>
  );
}
