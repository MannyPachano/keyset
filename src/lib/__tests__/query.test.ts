import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyFilters, applySort, matchesQuery, paginate, queryRows, statusCounts } from '../query.js';
import { DEFAULT_FILTERS, type Filters } from '../types.js';
import { DAY, NOW, make, rowsOf } from './fixtures.js';

const f = (over: Partial<Filters> = {}): Filters => ({ ...DEFAULT_FILTERS, ...over });

describe('matchesQuery', () => {
  const [row] = rowsOf([make({ contractorId: 'c1' })]);

  it('matches on the reference, the title, the unit, the tenant and the contractor', () => {
    for (const q of ['MR-1', 'sink', '1A', 'whitfield', 'halvorsen', 'ashgrove', 'plumbing']) {
      assert.equal(matchesQuery(row, q), true, q);
    }
  });

  it('ignores case and surrounding space', () => {
    assert.equal(matchesQuery(row, '  SINK  '), true);
  });

  it('requires every term, so a second word narrows instead of widening', () => {
    assert.equal(matchesQuery(row, 'sink ashgrove'), true);
    assert.equal(matchesQuery(row, 'sink beckett'), false);
  });

  it('treats an empty query as no filter at all', () => {
    assert.equal(matchesQuery(row, ''), true);
    assert.equal(matchesQuery(row, '   '), true);
  });
});

describe('applyFilters', () => {
  const rows = rowsOf([
    make({ id: 'a', status: 'new', priority: 'emergency', unitId: 'u1', contractorId: null,
           createdAt: new Date(NOW - 5 * DAY).toISOString() }),
    make({ id: 'b', status: 'scheduled', priority: 'routine', unitId: 'u3', contractorId: 'c1' }),
    make({ id: 'c', status: 'done', priority: 'urgent', unitId: 'u2', contractorId: 'c2',
           updatedAt: new Date(NOW - DAY).toISOString() }),
  ]);
  const ids = (fs: Filters) => applyFilters(rows, fs).map((r) => r.request.id);

  it('filters by status, and an explicit choice overrides the closed-work rule', () => {
    assert.deepEqual(ids(f({ status: ['new'] })), ['a']);
    assert.deepEqual(ids(f({ status: ['new', 'done'] })), ['a', 'c']);
    assert.deepEqual(ids(f({ status: ['done'] })), ['c'], 'asking for done shows done');
  });

  it('hides finished and cancelled work unless it is asked for', () => {
    assert.deepEqual(ids(f()), ['a', 'b'], 'the done one is not in the default view');
    assert.equal(ids(f({ includeClosed: true })).length, 3);
  });

  it('filters by priority and by property', () => {
    assert.deepEqual(ids(f({ priority: ['emergency'] })), ['a']);
    assert.deepEqual(ids(f({ propertyId: 'p2' })), ['b']);
  });

  it('separates assigned from unassigned', () => {
    assert.deepEqual(ids(f({ assignment: 'unassigned' })), ['a']);
    assert.deepEqual(ids(f({ assignment: 'assigned', includeClosed: true })), ['b', 'c']);
    assert.equal(ids(f({ assignment: 'any', includeClosed: true })).length, 3);
  });

  it('shows only late work, and never counts closed work as late', () => {
    assert.deepEqual(ids(f({ overdueOnly: true })), ['a']);
  });

  it('combines every dimension with AND', () => {
    assert.deepEqual(ids(f({ status: ['new', 'scheduled'], assignment: 'assigned' })), ['b']);
    assert.deepEqual(ids(f({ status: ['new'], assignment: 'assigned' })), []);
  });
});

describe('applySort', () => {
  it('orders emergency before urgent before routine, not alphabetically', () => {
    const rows = rowsOf([
      make({ id: 'x', priority: 'routine' }),
      make({ id: 'y', priority: 'emergency' }),
      make({ id: 'z', priority: 'urgent' }),
    ]);
    const asc = applySort(rows, { key: 'priority', dir: 'asc' }).map((r) => r.request.priority);
    assert.deepEqual(asc, ['emergency', 'urgent', 'routine']);
  });

  it('reverses cleanly', () => {
    const rows = rowsOf([make({ id: 'x', priority: 'routine' }), make({ id: 'y', priority: 'emergency' })]);
    const desc = applySort(rows, { key: 'priority', dir: 'desc' }).map((r) => r.request.priority);
    assert.deepEqual(desc, ['routine', 'emergency']);
  });

  it('puts unassigned last going up, because a blank is not a name', () => {
    const rows = rowsOf([
      make({ id: 'x', contractorId: null }),
      make({ id: 'y', contractorId: 'c2' }),
      make({ id: 'z', contractorId: 'c1' }),
    ]);
    const names = applySort(rows, { key: 'contractor', dir: 'asc' }).map((r) => r.contractorName);
    assert.deepEqual(names, ['Bright Line Electric', 'Halvorsen Plumbing', '']);
  });

  it('is stable, so equal rows never shuffle between sorts', () => {
    const rows = rowsOf([
      make({ id: 'a', priority: 'routine' }), make({ id: 'b', priority: 'routine' }),
      make({ id: 'c', priority: 'routine' }), make({ id: 'd', priority: 'routine' }),
    ]);
    const once = applySort(rows, { key: 'priority', dir: 'asc' }).map((r) => r.request.ref);
    const twice = applySort(applySort(rows, { key: 'priority', dir: 'asc' }), { key: 'priority', dir: 'asc' })
      .map((r) => r.request.ref);
    assert.deepEqual(once, twice);
    assert.deepEqual(once, [...once].sort());
  });

  it('does not mutate the array it was given', () => {
    const rows = rowsOf([make({ id: 'x', priority: 'routine' }), make({ id: 'y', priority: 'emergency' })]);
    const before = rows.map((r) => r.request.id);
    applySort(rows, { key: 'priority', dir: 'asc' });
    assert.deepEqual(rows.map((r) => r.request.id), before);
  });
});

describe('paginate', () => {
  const rows = rowsOf(Array.from({ length: 57 }, () => make()));

  it('reports a human range', () => {
    const p = paginate(rows, 1, 25);
    assert.equal(p.from, 1); assert.equal(p.to, 25);
    assert.equal(p.total, 57); assert.equal(p.pageCount, 3);
  });

  it('handles a short last page', () => {
    const p = paginate(rows, 3, 25);
    assert.equal(p.rows.length, 7);
    assert.equal(p.from, 51); assert.equal(p.to, 57);
  });

  it('clamps a page that no longer exists instead of showing nothing', () => {
    const p = paginate(rows, 99, 25);
    assert.equal(p.page, 3);
    assert.equal(p.rows.length, 7);
  });

  it('clamps a page below one', () => {
    assert.equal(paginate(rows, 0, 25).page, 1);
    assert.equal(paginate(rows, -5, 25).page, 1);
  });

  it('survives an empty result set', () => {
    const p = paginate([], 1, 25);
    assert.deepEqual(p.rows, []);
    assert.equal(p.total, 0); assert.equal(p.pageCount, 1);
    assert.equal(p.from, 0); assert.equal(p.to, 0);
  });
});

describe('queryRows', () => {
  it('filters, then sorts, then pages, in that order', () => {
    const rows = rowsOf([
      ...Array.from({ length: 30 }, () => make({ status: 'new', priority: 'routine' })),
      ...Array.from({ length: 5 }, () => make({ status: 'triaged', priority: 'emergency' })),
    ]);
    const page = queryRows(rows, f({ status: ['new'], sort: { key: 'priority', dir: 'asc' }, page: 2 }), 25);
    assert.equal(page.total, 30);
    assert.equal(page.rows.length, 5);
    assert.ok(page.rows.every((r) => r.request.status === 'new'));
  });
});

describe('statusCounts', () => {
  it('counts each status against the other filters but not against status itself', () => {
    const rows = rowsOf([
      make({ status: 'new', unitId: 'u1' }),
      make({ status: 'new', unitId: 'u1' }),
      make({ status: 'done', unitId: 'u1' }),
      make({ status: 'new', unitId: 'u3' }),
    ]);
    // Narrowed to property p1, but every status still reports its own count,
    // so selecting "done" can never look like it would return nothing.
    const counts = statusCounts(rows, f({ propertyId: 'p1', status: ['new'], includeClosed: true }));
    assert.equal(counts.new, 2);
    assert.equal(counts.done, 1);
  });

  it('can still count a closed status the default view would hide', () => {
    const rows = rowsOf([make({ status: 'new' }), make({ status: 'done' }), make({ status: 'cancelled' })]);
    const counts = statusCounts(rows, f({ includeClosed: true }));
    assert.equal(counts.done, 1);
    assert.equal(counts.cancelled, 1);
  });
});
