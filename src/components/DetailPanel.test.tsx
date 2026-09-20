import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DetailPanel } from './DetailPanel.js';
import { contractors, indexOf, make, rowsOf } from '../test/fixtures.js';

function setup(over = {}) {
  const request = make({ id: 'r1', ref: 'MR-1001', title: 'No hot water in the shower' });
  const [row] = rowsOf([request]);
  const props = {
    row,
    index: indexOf([request]),
    contractors,
    busy: false,
    onClose: vi.fn(),
    onStatus: vi.fn(),
    onPriority: vi.fn(),
    onAssign: vi.fn(),
    onSchedule: vi.fn(),
    onNote: vi.fn(),
    ...over,
  };
  return { props, ...render(<DetailPanel {...props} />) };
}

describe('DetailPanel', () => {
  it('is a modal dialog labelled by the request title', () => {
    setup();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('No hot water in the shower');
  });

  it('moves focus into the panel when it opens', () => {
    setup();
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
  });

  it('returns focus to whatever opened it when it closes', async () => {
    const opener = document.createElement('button');
    opener.textContent = 'MR-1001';
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = setup();
    expect(document.activeElement).not.toBe(opener);

    unmount();
    // Without this, closing the panel drops a keyboard user at the top of the
    // document and they have to tab all the way back to where they were.
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('falls back to the row when nothing opened it, as on a shared link', () => {
    /* Opening a request by its own URL means there is no opener: the panel is
       the first thing on the page and document.activeElement is the body.
       Focusing the body does nothing, so without a fallback the panel closes
       onto nothing and the next Tab starts again from the top. */
    (document.activeElement as HTMLElement | null)?.blur();
    const row = document.createElement('button');
    row.setAttribute('data-ref-for', 'r1');
    row.textContent = 'MR-1001';
    document.body.appendChild(row);

    const { unmount } = setup();
    unmount();

    expect(document.activeElement).toBe(row);
    row.remove();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const { props } = setup();
    await user.keyboard('{Escape}');
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it('keeps Tab inside the panel, wrapping from the last control to the first', async () => {
    const user = userEvent.setup();
    setup();
    const dialog = screen.getByRole('dialog');
    const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), select, input, textarea')];

    focusable[focusable.length - 1].focus();
    await user.tab();
    expect(document.activeElement).toBe(focusable[0]);

    await user.tab({ shift: true });
    expect(document.activeElement).toBe(focusable[focusable.length - 1]);
  });

  it('reports a change through the matching callback, not by mutating the row', async () => {
    const user = userEvent.setup();
    const { props } = setup();
    await user.selectOptions(screen.getByLabelText('Status'), 'in_progress');
    expect(props.onStatus).toHaveBeenCalledWith('in_progress');
    await user.selectOptions(screen.getByLabelText('Contractor'), 'c1');
    expect(props.onAssign).toHaveBeenCalledWith('c1');
  });

  it('will not submit an empty note', async () => {
    const user = userEvent.setup();
    const { props } = setup();
    const button = screen.getByRole('button', { name: 'Add note' });
    expect(button).toBeDisabled();

    await user.type(screen.getByLabelText('Add a note'), '   ');
    expect(button).toBeDisabled();

    await user.type(screen.getByLabelText('Add a note'), 'Contractor booked for Thursday.');
    await user.click(button);
    expect(props.onNote).toHaveBeenCalledWith('Contractor booked for Thursday.');
  });

  it('disables every control while a save is in flight', () => {
    setup({ busy: true });
    expect(screen.getByLabelText('Status')).toBeDisabled();
    expect(screen.getByLabelText('Priority')).toBeDisabled();
    expect(screen.getByLabelText('Contractor')).toBeDisabled();
    expect(screen.getByLabelText('Add a note')).toBeDisabled();
  });

  it('shows the history newest first', () => {
    const request = make({
      events: [
        { id: 'a', at: '2026-09-18T09:00:00.000Z', kind: 'opened', by: 'Priya Baranov' },
        { id: 'b', at: '2026-09-19T09:00:00.000Z', kind: 'note', by: 'Dana Whitfield', note: 'Called the tenant back.' },
      ],
    });
    const [row] = rowsOf([request]);
    render(<DetailPanel row={row} index={indexOf([request])} contractors={contractors} busy={false}
      onClose={vi.fn()} onStatus={vi.fn()} onPriority={vi.fn()} onAssign={vi.fn()} onSchedule={vi.fn()} onNote={vi.fn()} />);
    const items = screen.getAllByRole('listitem').filter((li) => li.className.includes('timeline-item'));
    expect(items[0].textContent).toContain('Called the tenant back.');
  });
});
