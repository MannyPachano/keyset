import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, ageMs, formatAge, groupByDay, isOverdue, isoDay, slaProgress, startOfWeek, weekDays } from '../dates.js';
import type { MaintenanceRequest, Priority, Status } from '../types.js';

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const NOW = Date.parse('2026-09-20T12:00:00.000Z');

function req(over: Partial<MaintenanceRequest> = {}): MaintenanceRequest {
  return {
    id: 'r1', ref: 'MR-1000', unitId: 'u1', tenantId: 't1',
    title: 'Leak', detail: '', category: 'plumbing',
    priority: 'routine' as Priority, status: 'new' as Status,
    createdAt: new Date(NOW - 3 * DAY).toISOString(),
    updatedAt: new Date(NOW - 3 * DAY).toISOString(),
    contractorId: null, scheduledFor: null, events: [],
    ...over,
  };
}

describe('ageMs', () => {
  it('measures from opening to now while a request is open', () => {
    assert.equal(ageMs(req(), NOW), 3 * DAY);
  });

  it('freezes at the closing time once done, so old jobs stop ageing', () => {
    const r = req({ status: 'done', updatedAt: new Date(NOW - 2 * DAY).toISOString() });
    assert.equal(ageMs(r, NOW), DAY);
    // A year later it is still one day old, not a year.
    assert.equal(ageMs(r, NOW + 365 * DAY), DAY);
  });

  it('never returns a negative age for a request created in the future', () => {
    assert.equal(ageMs(req({ createdAt: new Date(NOW + DAY).toISOString() }), NOW), 0);
  });
});

describe('isOverdue', () => {
  it('uses a different deadline per priority', () => {
    const at = (h: number) => new Date(NOW - h * HOUR).toISOString();
    assert.equal(isOverdue(req({ priority: 'emergency', createdAt: at(3) }), NOW), false);
    assert.equal(isOverdue(req({ priority: 'emergency', createdAt: at(5) }), NOW), true);
    assert.equal(isOverdue(req({ priority: 'urgent', createdAt: at(5) }), NOW), false);
    assert.equal(isOverdue(req({ priority: 'urgent', createdAt: at(49) }), NOW), true);
    assert.equal(isOverdue(req({ priority: 'routine', createdAt: at(49) }), NOW), false);
  });

  it('is never overdue once closed, however old it was', () => {
    for (const status of ['done', 'cancelled'] as Status[]) {
      const r = req({ status, priority: 'emergency', createdAt: new Date(NOW - 90 * DAY).toISOString() });
      assert.equal(isOverdue(r, NOW), false, status);
      assert.equal(slaProgress(r, NOW), 0, status);
    }
  });

  it('is exactly on the boundary, not over it, at the deadline', () => {
    const r = req({ priority: 'emergency', createdAt: new Date(NOW - 4 * HOUR).toISOString() });
    assert.equal(isOverdue(r, NOW), false);
    assert.equal(slaProgress(r, NOW), 1);
  });
});

describe('formatAge', () => {
  it('reads the way a person would say it', () => {
    assert.equal(formatAge(30_000), 'just now');
    assert.equal(formatAge(60_000), '1 minute');
    assert.equal(formatAge(5 * 60_000), '5 minutes');
    assert.equal(formatAge(HOUR), '1 hour');
    assert.equal(formatAge(3 * HOUR), '3 hours');
    assert.equal(formatAge(DAY), '1 day');
    assert.equal(formatAge(9 * DAY), '9 days');
    assert.equal(formatAge(60 * DAY), '2 months');
  });
});

describe('calendar helpers', () => {
  it('rolls over a month end', () => {
    assert.equal(addDays('2026-01-31', 1), '2026-02-01');
    assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  });

  it('handles a leap year', () => {
    assert.equal(addDays('2028-02-28', 1), '2028-02-29');
    assert.equal(addDays('2028-02-29', 1), '2028-03-01');
  });

  it('starts the week on Monday whatever day you ask about', () => {
    // 2026-09-20 is a Sunday, so its week began on the 14th.
    assert.equal(startOfWeek('2026-09-20'), '2026-09-14');
    assert.equal(startOfWeek('2026-09-14'), '2026-09-14');
    assert.equal(startOfWeek('2026-09-19'), '2026-09-14');
    assert.equal(startOfWeek('2026-09-21'), '2026-09-21');
  });

  it('gives seven consecutive days', () => {
    const days = weekDays('2026-09-20');
    assert.equal(days.length, 7);
    assert.equal(days[0], '2026-09-14');
    assert.equal(days[6], '2026-09-20');
    assert.deepEqual([...new Set(days)], days);
  });

  it('formats a local day without drifting a timezone', () => {
    assert.equal(isoDay(new Date(2026, 0, 5)), '2026-01-05');
  });
});

describe('groupByDay', () => {
  const days = weekDays('2026-09-20');

  it('keeps empty days so the board never collapses', () => {
    const grouped = groupByDay([], days);
    assert.equal(Object.keys(grouped).length, 7);
    assert.deepEqual(grouped[days[3]], []);
  });

  it('files each request under the day it is booked for', () => {
    const a = req({ id: 'a', scheduledFor: days[1] });
    const b = req({ id: 'b', scheduledFor: days[1] });
    const c = req({ id: 'c', scheduledFor: days[5] });
    const grouped = groupByDay([a, b, c], days);
    assert.deepEqual(grouped[days[1]].map((r) => r.id), ['a', 'b']);
    assert.deepEqual(grouped[days[5]].map((r) => r.id), ['c']);
  });

  it('ignores anything scheduled outside the week, rather than throwing', () => {
    const grouped = groupByDay([req({ scheduledFor: '2019-01-01' }), req({ scheduledFor: null })], days);
    assert.equal(Object.values(grouped).flat().length, 0);
  });
});
