import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueueView } from './QueueView.js';
import { contractors, filters, make, properties, rowsOf } from '../test/fixtures.js';

function setup(over: Partial<Parameters<typeof QueueView>[0]> = {}) {
  const props = {
    rows: rowsOf([make({ id: 'r1', status: 'new' }), make({ id: 'r2', status: 'triaged' })]),
    properties,
    contractors,
    filters: filters(),
    openId: null,
    selected: new Set<string>(),
    lastResult: null,
    loading: false,
    busy: false,
    onDismissResult: vi.fn(),
    onFilters: vi.fn(),
    onPage: vi.fn(),
    onOpen: vi.fn(),
    onSelect: vi.fn(),
    onSelectAll: vi.fn(),
    onClearSelection: vi.fn(),
    onBulkAssign: vi.fn(),
    onBulkStatus: vi.fn(),
    onBulkPriority: vi.fn(),
    ...over,
  };
  return { props, ...render(<QueueView {...props} />) };
}

describe('QueueView empty states', () => {
  it('says the queue is empty when nothing is filtered', () => {
    setup({ rows: [] });
    expect(screen.getByText('Nothing in the queue')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('says the filters matched nothing, and offers a way out, when they are narrowed', async () => {
    const user = userEvent.setup();
    const { props } = setup({ rows: [], filters: filters({ q: 'nothing matches this' }) });
    expect(screen.getByText('No requests match these filters')).toBeInTheDocument();

    // The two situations need different messages. Telling someone "nothing in
    // the queue" while a filter is hiding everything sends them looking for a
    // problem that is not there.
    // Two buttons read "Clear filters" here: one in the filter bar, one in the
    // empty state. The empty state's is the one under test, so scope to it
    // rather than relying on which comes first in the document.
    const panel = screen.getByText('No requests match these filters').closest('.empty') as HTMLElement;
    await user.click(within(panel).getByRole('button', { name: 'Clear filters' }));
    expect(props.onFilters).toHaveBeenCalled();
  });
});

describe('QueueView bulk bar', () => {
  it('stays hidden until something is selected', () => {
    setup();
    expect(screen.queryByRole('group', { name: /selected requests/i })).not.toBeInTheDocument();
  });

  it('counts the selection in words a person reads', () => {
    const { unmount } = setup({ selected: new Set(['r1']) });
    expect(screen.getByText(/request selected/)).toHaveTextContent('1 request selected');
    unmount();
    setup({ selected: new Set(['r1', 'r2']) });
    expect(screen.getByText(/requests selected/)).toHaveTextContent('2 requests selected');
  });
});

describe('QueueView loading', () => {
  it('shows a skeleton and still lets the filters be used', () => {
    setup({ loading: true });
    expect(screen.getByRole('status')).toHaveTextContent('Loading the queue');
    expect(screen.getByPlaceholderText(/Reference, unit, tenant/)).toBeInTheDocument();
  });
});

describe('QueueView result banner', () => {
  it('says where rows went when a change pushed them out of the view', () => {
    setup({ lastResult: { label: 'Status set to cancelled', requestIds: ['r9', 'r8'] } });
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('Status set to cancelled');
    expect(banner).toHaveTextContent('2 requests no longer match');
  });

  it('stays quiet when the changed rows are still on screen', () => {
    setup({ lastResult: { label: 'Priority set to urgent', requestIds: ['r1'] } });
    expect(screen.queryByText(/no longer match/)).not.toBeInTheDocument();
  });
});
