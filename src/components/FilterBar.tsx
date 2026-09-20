import { useEffect, useId, useState } from 'react';
import { PRIORITIES, STATUSES, type Filters, type Property, type Status, type Priority } from '../lib/types.js';
import { isUnfiltered } from '../lib/url.js';
import { PRIORITY_LABEL, STATUS_LABEL } from './ui/Pill.js';

interface Props {
  filters: Filters;
  properties: Property[];
  statusCounts: Record<string, number>;
  overdueCount: number;
  onChange: (next: Partial<Filters>) => void;
  onClear: () => void;
}

export function FilterBar({ filters, properties, statusCounts, overdueCount, onChange, onClear }: Props) {
  const searchId = useId();
  const propertyId = useId();
  const assignId = useId();

  // The box holds its own value so typing never feels laggy; the parent gets
  // the debounced one.
  const [term, setTerm] = useState(filters.q);
  useEffect(() => { setTerm(filters.q); }, [filters.q]);

  const toggle = <T extends string>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  return (
    <div className="filters">
      <div className="filters-row">
        <div className="field field-search">
          <label htmlFor={searchId} className="visually-hidden">Search requests</label>
          <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input
            id={searchId}
            type="search"
            className="input"
            placeholder="Reference, unit, tenant, contractor"
            value={term}
            onChange={(e) => { setTerm(e.target.value); onChange({ q: e.target.value }); }}
          />
        </div>

        <div className="field">
          <label htmlFor={propertyId} className="field-label">Property</label>
          <select
            id={propertyId}
            className="input"
            value={filters.propertyId ?? ''}
            onChange={(e) => onChange({ propertyId: e.target.value || null })}
          >
            <option value="">All properties</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div className="field">
          <label htmlFor={assignId} className="field-label">Contractor</label>
          <select
            id={assignId}
            className="input"
            value={filters.assignment}
            onChange={(e) => onChange({ assignment: e.target.value as Filters['assignment'] })}
          >
            <option value="any">Assigned or not</option>
            <option value="unassigned">Not yet assigned</option>
            <option value="assigned">Assigned</option>
          </select>
        </div>

        {!isUnfiltered(filters) && (
          <button type="button" className="btn btn-quiet filters-clear" onClick={onClear}>
            Clear filters
          </button>
        )}
      </div>

      <div className="filters-row filters-chips">
        <fieldset className="chipset">
          <legend className="visually-hidden">Filter by status</legend>
          {STATUSES.map((s: Status) => (
            <button
              key={s}
              type="button"
              className="chip"
              aria-pressed={filters.status.includes(s)}
              onClick={() => onChange({ status: toggle(filters.status, s) })}
            >
              {STATUS_LABEL[s]}
              <span className="chip-count">{statusCounts[s] ?? 0}</span>
            </button>
          ))}
        </fieldset>

        <fieldset className="chipset">
          <legend className="visually-hidden">Filter by priority</legend>
          {PRIORITIES.map((p: Priority) => (
            <button
              key={p}
              type="button"
              className={`chip chip-${p}`}
              aria-pressed={filters.priority.includes(p)}
              onClick={() => onChange({ priority: toggle(filters.priority, p) })}
            >
              {PRIORITY_LABEL[p]}
            </button>
          ))}
        </fieldset>

        <div className="chipset">
          <button
            type="button"
            className="chip chip-overdue"
            aria-pressed={filters.overdueOnly}
            onClick={() => onChange({ overdueOnly: !filters.overdueOnly })}
          >
            Past due
            <span className="chip-count">{overdueCount}</span>
          </button>
          <button
            type="button"
            className="chip"
            aria-pressed={filters.includeClosed}
            onClick={() => onChange({ includeClosed: !filters.includeClosed })}
          >
            Include finished
          </button>
        </div>
      </div>
    </div>
  );
}
