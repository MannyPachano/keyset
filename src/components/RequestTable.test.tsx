import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RequestTable } from './RequestTable.js';
import { paginate } from '../lib/query.js';
import { make, rowsOf } from '../test/fixtures.js';

function setup(over: Partial<Parameters<typeof RequestTable>[0]> = {}) {
  const rows = rowsOf([
    make({ id: 'r1', ref: 'MR-1001', priority: 'routine', contractorId: null }),
    make({ id: 'r2', ref: 'MR-1002', priority: 'emergency', contractorId: 'c1' }),
    make({ id: 'r3', ref: 'MR-1003', priority: 'urgent', contractorId: 'c2' }),
  ]);
  const props = {
    page: paginate(rows, 1, 25),
    sort: { key: 'age' as const, dir: 'desc' as const },
    selected: new Set<string>(),
    openId: null,
    onSort: vi.fn(),
    onSelect: vi.fn(),
    onSelectAll: vi.fn(),
    onOpen: vi.fn(),
    ...over,
  };
  return { props, ...render(<RequestTable {...props} />) };
}

describe('RequestTable', () => {
  it('marks only the sorted column, and in the right direction', () => {
    setup({ sort: { key: 'priority', dir: 'asc' } });
    const headers = screen.getAllByRole('columnheader');
    const sorted = headers.filter((h) => h.getAttribute('aria-sort') !== 'none' && h.hasAttribute('aria-sort'));
    expect(sorted).toHaveLength(1);
    expect(sorted[0]).toHaveTextContent('Priority');
    expect(sorted[0]).toHaveAttribute('aria-sort', 'ascending');
  });

  it('asks for a sort when a header is activated, by keyboard as well as mouse', async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    setup({ onSort });

    await user.click(screen.getByRole('button', { name: /Priority/ }));
    expect(onSort).toHaveBeenCalledWith('priority');

    onSort.mockClear();
    screen.getByRole('button', { name: /Contractor/ }).focus();
    await user.keyboard('{Enter}');
    expect(onSort).toHaveBeenCalledWith('contractor');
  });

  it('gives every row checkbox a label that says which request it selects', () => {
    setup();
    expect(screen.getByRole('checkbox', { name: /MR-1002/ })).toBeInTheDocument();
  });

  it('is indeterminate when only some rows on the page are selected', () => {
    const { unmount } = setup({ selected: new Set(['r1']) });
    const all = screen.getByRole('checkbox', { name: /Select every request/ }) as HTMLInputElement;
    expect(all.indeterminate).toBe(true);
    expect(all.checked).toBe(false);
    unmount();

    setup({ selected: new Set(['r1', 'r2', 'r3']) });
    const full = screen.getByRole('checkbox', { name: /Clear selection/ }) as HTMLInputElement;
    expect(full.indeterminate).toBe(false);
    expect(full.checked).toBe(true);
  });

  it('opens a request from its reference', async () => {
    const user = userEvent.setup();
    const { props } = setup();
    await user.click(screen.getByRole('button', { name: 'MR-1003' }));
    expect(props.onOpen).toHaveBeenCalledWith('r3');
  });

  it('says a contractor is missing rather than leaving the cell blank', () => {
    setup();
    expect(screen.getByText('Not assigned')).toBeInTheDocument();
  });

  it('carries a caption explaining how to sort and multi-select', () => {
    setup();
    expect(screen.getByRole('table')).toHaveAccessibleName(/Shift-click a checkbox to select a range/);
  });
});
