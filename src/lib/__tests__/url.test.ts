import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filtersToParams, isUnfiltered, openIdFromParams, paramsToFilters, toSearchString, viewFromParams } from '../url.js';
import { DEFAULT_FILTERS, type Filters } from '../types.js';

const f = (over: Partial<Filters> = {}): Filters => ({ ...DEFAULT_FILTERS, ...over });
const roundTrip = (fs: Filters): Filters => paramsToFilters(filtersToParams(fs));

describe('filters in the URL', () => {
  it('writes nothing at all for the default view', () => {
    assert.equal(filtersToParams(f()).toString(), '');
    assert.equal(toSearchString(f()), '');
  });

  it('survives a round trip with everything set', () => {
    const full = f({
      q: 'beckett leak',
      status: ['new', 'in_progress'],
      priority: ['emergency'],
      propertyId: 'p2',
      assignment: 'unassigned',
      overdueOnly: true,
      includeClosed: true,
      sort: { key: 'priority', dir: 'asc' },
      page: 4,
    });
    assert.deepEqual(roundTrip(full), full);
  });

  it('trims the search term rather than storing padding', () => {
    assert.equal(roundTrip(f({ q: '   leak   ' })).q, 'leak');
  });

  it('carries the open request separately from the filters', () => {
    const p = filtersToParams(f(), 'r42');
    assert.equal(openIdFromParams(p), 'r42');
    assert.equal(openIdFromParams(filtersToParams(f())), null);
  });

  it('produces a pasteable string with the leading question mark', () => {
    assert.equal(toSearchString(f({ overdueOnly: true })), '?overdue=1');
  });
});

describe('a hand-edited or truncated URL', () => {
  it('drops statuses and priorities it does not recognise', () => {
    const out = paramsToFilters(new URLSearchParams('status=new,nonsense,done&priority=made_up'));
    assert.deepEqual(out.status, ['new', 'done']);
    assert.deepEqual(out.priority, []);
  });

  it('de-duplicates repeated values', () => {
    assert.deepEqual(paramsToFilters(new URLSearchParams('status=new,new,new')).status, ['new']);
  });

  it('falls back to the default sort when the key is unknown', () => {
    const out = paramsToFilters(new URLSearchParams('sort=rm%20-rf&dir=sideways'));
    assert.deepEqual(out.sort, DEFAULT_FILTERS.sort);
  });

  it('refuses a page that is not a positive number', () => {
    for (const raw of ['page=0', 'page=-3', 'page=abc', 'page=']) {
      assert.equal(paramsToFilters(new URLSearchParams(raw)).page, 1, raw);
    }
  });

  it('treats an unknown assignment as no constraint', () => {
    assert.equal(paramsToFilters(new URLSearchParams('assign=maybe')).assignment, 'any');
  });

  it('returns the default view for an empty query string', () => {
    assert.deepEqual(paramsToFilters(new URLSearchParams('')), DEFAULT_FILTERS);
  });
});

describe('isUnfiltered', () => {
  it('is true only when nothing is narrowing the list', () => {
    assert.equal(isUnfiltered(f()), true);
    // Sorting and paging are not narrowing, so they do not count.
    assert.equal(isUnfiltered(f({ sort: { key: 'ref', dir: 'asc' }, page: 3 })), true);
  });

  it('is false for each thing that does narrow it', () => {
    assert.equal(isUnfiltered(f({ q: 'leak' })), false);
    assert.equal(isUnfiltered(f({ status: ['new'] })), false);
    assert.equal(isUnfiltered(f({ priority: ['urgent'] })), false);
    assert.equal(isUnfiltered(f({ propertyId: 'p1' })), false);
    assert.equal(isUnfiltered(f({ assignment: 'assigned' })), false);
    assert.equal(isUnfiltered(f({ overdueOnly: true })), false);
    assert.equal(isUnfiltered(f({ includeClosed: true })), false);
  });

  it('ignores a search box holding only spaces', () => {
    assert.equal(isUnfiltered(f({ q: '   ' })), true);
  });
});

describe('the view', () => {
  it('defaults to the queue, and anything unrecognised falls back to it', () => {
    assert.equal(viewFromParams(new URLSearchParams('')), 'queue');
    assert.equal(viewFromParams(new URLSearchParams('view=week')), 'week');
    assert.equal(viewFromParams(new URLSearchParams('view=gantt')), 'queue');
  });

  it('writes nothing for the queue and round-trips the board', () => {
    assert.equal(toSearchString(f(), null, 'queue'), '');
    assert.equal(viewFromParams(filtersToParams(f(), null, 'week')), 'week');
  });

  it('keeps the filters alongside the board, so a narrowed board is linkable', () => {
    const narrowed = f({ propertyId: 'p2', priority: ['emergency'] });
    const p = filtersToParams(narrowed, null, 'week');
    assert.equal(viewFromParams(p), 'week');
    assert.deepEqual(paramsToFilters(p).priority, ['emergency']);
    assert.equal(paramsToFilters(p).propertyId, 'p2');
  });
});
