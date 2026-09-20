import type { MouseEvent } from 'react';
import { formatAge } from '../lib/dates.js';
import type { Page, Row } from '../lib/query.js';
import type { Sort, SortKey } from '../lib/types.js';
import { PriorityPill, StatusPill } from './ui/Pill.js';

interface Props {
  page: Page;
  sort: Sort;
  selected: Set<string>;
  openId: string | null;
  onSort: (key: SortKey) => void;
  onSelect: (id: string, event: MouseEvent) => void;
  onSelectAll: () => void;
  onOpen: (id: string) => void;
}

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: 'ref', label: 'Ref' },
  { key: 'property', label: 'Property and unit' },
  { key: 'title', label: 'Issue' },
  { key: 'priority', label: 'Priority' },
  { key: 'status', label: 'Status' },
  { key: 'contractor', label: 'Contractor' },
  { key: 'age', label: 'Open for', className: 'col-num' },
];

export function RequestTable({ page, sort, selected, openId, onSort, onSelect, onSelectAll, onOpen }: Props) {
  const ids = page.rows.map((r) => r.request.id);
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
  const someSelected = ids.some((id) => selected.has(id));

  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="visually-hidden">
          Maintenance requests. Use the column headers to sort. Shift-click a checkbox to select a range.
        </caption>
        <thead>
          <tr>
            <th scope="col" className="col-check">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => { if (el) el.indeterminate = !allSelected && someSelected; }}
                onChange={onSelectAll}
                aria-label={allSelected ? 'Clear selection on this page' : 'Select every request on this page'}
              />
            </th>
            {COLUMNS.map((col) => {
              const active = sort.key === col.key;
              return (
                <th
                  key={col.key}
                  scope="col"
                  className={col.className}
                  aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <button type="button" className="th-sort" onClick={() => onSort(col.key)}>
                    {col.label}
                    <span className={`th-arrow${active ? ' is-active' : ''}`} aria-hidden="true">
                      {active && sort.dir === 'asc' ? '↑' : '↓'}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {page.rows.map((row) => (
            <RequestRow
              key={row.request.id}
              row={row}
              checked={selected.has(row.request.id)}
              isOpen={openId === row.request.id}
              onSelect={onSelect}
              onOpen={onOpen}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface RowProps {
  row: Row;
  checked: boolean;
  isOpen: boolean;
  onSelect: (id: string, event: MouseEvent) => void;
  onOpen: (id: string) => void;
}

function RequestRow({ row, checked, isOpen, onSelect, onOpen }: RowProps) {
  const { request: r } = row;
  // Capped at the full width: a job three weeks past its deadline should read
  // as late, not draw a bar out of the cell.
  const progress = Math.min(row.sla, 1);

  return (
    <tr className={`row${checked ? ' is-selected' : ''}${isOpen ? ' is-open' : ''}${row.overdue ? ' is-overdue' : ''}`}>
      <td className="col-check">
        <input
          type="checkbox"
          checked={checked}
          onChange={() => undefined}
          onClick={(e) => onSelect(r.id, e)}
          aria-label={`Select ${r.ref}, ${r.title}`}
        />
      </td>
      <td className="col-ref">
        <button type="button" className="ref-link" onClick={() => onOpen(r.id)} aria-expanded={isOpen}>
          {r.ref}
        </button>
      </td>
      <td>
        <span className="cell-strong">{row.propertyName}</span>
        <span className="cell-sub">Unit {row.unitLabel} &middot; {row.tenantName}</span>
      </td>
      <td className="col-title">
        <span className="cell-strong">{r.title}</span>
        <span className="cell-sub">{r.category.replace('_', ' ')}</span>
      </td>
      <td><PriorityPill priority={r.priority} /></td>
      <td><StatusPill status={r.status} /></td>
      <td>
        {row.contractorName
          ? <span className="cell-strong">{row.contractorName}</span>
          : <span className="cell-none">Not assigned</span>}
      </td>
      <td className="col-num">
        <span className={`age${row.overdue ? ' is-overdue' : ''}`}>{formatAge(row.ageMs)}</span>
        <span className="sla" aria-hidden="true">
          <span className="sla-fill" style={{ width: `${progress * 100}%` }} />
        </span>
        {row.overdue && <span className="visually-hidden">Past due</span>}
      </td>
    </tr>
  );
}
