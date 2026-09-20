import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WeekBoard } from './WeekBoard.js';
import { isoDay, startOfWeek } from '../lib/dates.js';
import { NOW, filters, make, rowsOf } from '../test/fixtures.js';

const MONDAY = startOfWeek(isoDay(new Date(NOW)));
const day = (n: number) => {
  const [y, m, d] = MONDAY.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
};

function setup(over: Partial<Parameters<typeof WeekBoard>[0]> = {}) {
  const props = {
    rows: rowsOf([
      make({ id: 'r1', ref: 'MR-2001', status: 'scheduled', scheduledFor: day(2) }),
      make({ id: 'r2', ref: 'MR-2002', status: 'scheduled', scheduledFor: day(2) }),
      make({ id: 'r3', ref: 'MR-2003', status: 'in_progress', scheduledFor: day(4) }),
    ]),
    filters: filters(),
    now: NOW,
    busy: false,
    onMove: vi.fn(),
    onOpen: vi.fn(),
    ...over,
  };
  return { props, ...render(<WeekBoard {...props} />) };
}

/* Moving a visit is done from the card's own handle, not the card. The card
   holds a link to the request, and a control cannot contain another control. */
const handle = (ref: string) => screen.getByRole('button', { name: `Move ${ref} to another day` });

describe('WeekBoard', () => {
  it('always shows seven days, including the empty ones', () => {
    setup();
    for (const name of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    // Empty days still have to be drop targets, so they cannot be dropped from
    // the grid. Most of this week is empty, so this counts them rather than
    // asking for the one.
    const regions = screen.getAllByRole('region');
    expect(regions).toHaveLength(7);
    const empty = regions.filter((d) => /, 0 visits$/.test(d.getAttribute('aria-label') ?? ''));
    expect(empty.length).toBeGreaterThan(0);
  });

  it('counts the visits in the range', () => {
    setup();
    expect(screen.getByText(/visits/, { selector: '.board-range' })).toHaveTextContent('3 visits');
  });

  it('says so when a week has nothing booked', () => {
    setup({ rows: [] });
    expect(screen.getByText('No visits booked this week')).toBeInTheDocument();
  });

  it('moves a card with the keyboard: pick up, choose a day, drop', async () => {
    const user = userEvent.setup();
    const { props } = setup();
    const grip = handle('MR-2001');

    grip.focus();
    await user.keyboard('{Enter}');
    expect(grip).toHaveAttribute('aria-pressed', 'true');

    await user.keyboard('{ArrowRight}');
    await user.keyboard('{Enter}');

    // Dropping one day to the right of Wednesday is Thursday.
    expect(props.onMove).toHaveBeenCalledWith('r1', day(3));
  });

  it('puts a card back on Escape without moving it', async () => {
    const user = userEvent.setup();
    const { props } = setup();
    const grip = handle('MR-2002');

    grip.focus();
    await user.keyboard('{Enter}');
    await user.keyboard('{ArrowRight}{ArrowRight}');
    await user.keyboard('{Escape}');

    expect(props.onMove).not.toHaveBeenCalled();
    expect(grip).toHaveAttribute('aria-pressed', 'false');
  });

  it('does not report a move when the card is dropped where it started', async () => {
    const user = userEvent.setup();
    const { props } = setup();
    handle('MR-2001').focus();
    await user.keyboard('{Enter}{Enter}');
    expect(props.onMove).not.toHaveBeenCalled();
  });

  it('will not walk a card off either end of the week', async () => {
    const user = userEvent.setup();
    const { props } = setup();
    handle('MR-2003').focus();
    await user.keyboard('{Enter}');
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}');
    await user.keyboard('{Enter}');

    // Friday plus five presses would be the middle of next week; it stops at Sunday.
    expect(props.onMove).toHaveBeenCalledWith('r3', day(6));
  });

  it('announces where the card is heading as it moves', async () => {
    const user = userEvent.setup();
    setup();
    handle('MR-2001').focus();
    await user.keyboard('{Enter}');

    const live = document.querySelector('[aria-live="assertive"]') as HTMLElement;
    expect(live).toHaveTextContent(/arrow keys/i);
    await user.keyboard('{ArrowRight}');
    expect(live).toHaveTextContent(/already booked/);
  });

  it('gives the move action its own control rather than nesting one button in another', () => {
    setup();
    const card = screen.getByText('MR-2001').closest('.board-card') as HTMLElement;

    /* The card was a button wrapping the reference button. Nesting two controls
       is invalid and leaves the inner one unreachable to a screen reader, so
       the card is plain now and the drag lives on a handle of its own. */
    expect(card).not.toHaveAttribute('role', 'button');
    expect(card).not.toHaveAttribute('tabindex');

    const grip = handle('MR-2001');
    expect(grip).toHaveAttribute('aria-roledescription', 'Move handle');
    expect(grip).toHaveAttribute('aria-pressed', 'false');
    expect(grip).toHaveAccessibleDescription(/arrow keys/i);
  });

  it('opens a request from the card without moving it', async () => {
    const user = userEvent.setup();
    const { props } = setup();
    await user.click(within(screen.getByText('MR-2003').closest('.board-card') as HTMLElement).getByRole('button', { name: 'MR-2003' }));
    expect(props.onOpen).toHaveBeenCalledWith('r3');
    expect(props.onMove).not.toHaveBeenCalled();
  });
});
