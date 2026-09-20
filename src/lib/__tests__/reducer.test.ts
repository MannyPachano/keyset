import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, mutations, reducer, type PendingMutation, type State } from '../reducer.js';
import type { Dataset, MaintenanceRequest } from '../types.js';
import { dataset, make } from './fixtures.js';

const AT = '2026-09-20T12:00:00.000Z';

function state(requests: MaintenanceRequest[]): State {
  const data: Dataset = { ...dataset, requests };
  return initialState(data);
}

const byId = (s: State, id: string) => s.data.requests.find((r) => r.id === id)!;

function pending(over: Partial<PendingMutation> = {}): PendingMutation {
  return { id: 'm1', kind: 'status', requestIds: [], previous: [], label: 'Marked done', ...over };
}

describe('selection', () => {
  const s0 = state([make({ id: 'a' }), make({ id: 'b' }), make({ id: 'c' }), make({ id: 'd' })]);
  const visible = ['a', 'b', 'c', 'd'];

  it('toggles a row on and off', () => {
    const on = reducer(s0, { type: 'select', id: 'b', mode: 'toggle' });
    assert.deepEqual([...on.selected], ['b']);
    const off = reducer(on, { type: 'select', id: 'b', mode: 'toggle' });
    assert.deepEqual([...off.selected], []);
  });

  it('replaces the selection in "only" mode', () => {
    let s = reducer(s0, { type: 'select', id: 'a', mode: 'toggle' });
    s = reducer(s, { type: 'select', id: 'c', mode: 'only' });
    assert.deepEqual([...s.selected], ['c']);
  });

  it('selects a range from the anchor, in either direction', () => {
    let s = reducer(s0, { type: 'select', id: 'b', mode: 'toggle' });
    s = reducer(s, { type: 'selectRange', id: 'd', visibleIds: visible });
    assert.deepEqual([...s.selected].sort(), ['b', 'c', 'd']);

    let up = reducer(s0, { type: 'select', id: 'd', mode: 'toggle' });
    up = reducer(up, { type: 'selectRange', id: 'b', visibleIds: visible });
    assert.deepEqual([...up.selected].sort(), ['b', 'c', 'd']);
  });

  it('behaves like a plain click when there is no anchor yet', () => {
    const s = reducer(s0, { type: 'selectRange', id: 'c', visibleIds: visible });
    assert.deepEqual([...s.selected], ['c']);
  });

  it('behaves like a plain click when the anchor has been filtered off the page', () => {
    let s = reducer(s0, { type: 'select', id: 'a', mode: 'toggle' });
    s = reducer(s, { type: 'selectRange', id: 'c', visibleIds: ['c', 'd'] });
    assert.deepEqual([...s.selected].sort(), ['a', 'c']);
  });

  it('select-all adds every visible row, then clears them on a second press', () => {
    const on = reducer(s0, { type: 'selectAll', visibleIds: visible });
    assert.equal(on.selected.size, 4);
    const off = reducer(on, { type: 'selectAll', visibleIds: visible });
    assert.equal(off.selected.size, 0);
  });

  it('select-all leaves rows selected on other pages alone', () => {
    let s = reducer(s0, { type: 'select', id: 'd', mode: 'toggle' });
    s = reducer(s, { type: 'selectAll', visibleIds: ['a', 'b'] });
    assert.deepEqual([...s.selected].sort(), ['a', 'b', 'd']);
    s = reducer(s, { type: 'selectAll', visibleIds: ['a', 'b'] });
    assert.deepEqual([...s.selected], ['d']);
  });
});

describe('optimistic mutation', () => {
  const base = () => state([make({ id: 'a', status: 'new' }), make({ id: 'b', status: 'new' }), make({ id: 'c', status: 'new' })]);

  it('changes the rows immediately, before any answer comes back', () => {
    const s0 = base();
    const previous = s0.data.requests.filter((r) => r.id !== 'c');
    const s = reducer(s0, {
      type: 'mutateStart',
      mutation: pending({ requestIds: ['a', 'b'], previous }),
      apply: mutations.status('done', 'Dana', AT),
    });
    assert.equal(byId(s, 'a').status, 'done');
    assert.equal(byId(s, 'b').status, 'done');
    assert.equal(byId(s, 'c').status, 'new', 'untouched rows stay untouched');
    assert.equal(s.pending.length, 1);
  });

  it('announces the result when it succeeds', () => {
    let s = base();
    s = reducer(s, { type: 'mutateStart', mutation: pending({ requestIds: ['a', 'b'], previous: [] }), apply: mutations.status('done', 'Dana', AT) });
    s = reducer(s, { type: 'mutateOk', id: 'm1' });
    assert.equal(s.pending.length, 0);
    assert.equal(s.announcement, 'Marked done. 2 requests updated.');
  });

  it('says "1 request" rather than "1 requests"', () => {
    let s = base();
    s = reducer(s, { type: 'mutateStart', mutation: pending({ requestIds: ['a'], previous: [] }), apply: mutations.status('done', 'Dana', AT) });
    s = reducer(s, { type: 'mutateOk', id: 'm1' });
    assert.equal(s.announcement, 'Marked done. 1 request updated.');
  });

  it('puts the rows back exactly as they were when it fails', () => {
    const s0 = base();
    const previous = s0.data.requests.filter((r) => r.id !== 'c').map((r) => ({ ...r }));
    let s = reducer(s0, { type: 'mutateStart', mutation: pending({ requestIds: ['a', 'b'], previous }), apply: mutations.status('done', 'Dana', AT) });
    assert.equal(byId(s, 'a').events.length, 1, 'the optimistic change added an event');

    s = reducer(s, { type: 'mutateFail', id: 'm1', message: 'Network error' });
    assert.deepEqual(byId(s, 'a'), previous[0], 'restored field for field, including the event list');
    assert.deepEqual(byId(s, 'b'), previous[1]);
    assert.equal(byId(s, 'c').status, 'new');
    assert.equal(s.lastError, 'Network error');
    assert.equal(s.pending.length, 0);
    assert.equal(s.announcement, 'Marked done failed. 2 requests put back.');
  });

  it('keeps two changes in flight apart, so one failing does not undo the other', () => {
    const s0 = base();
    const prevA = [{ ...s0.data.requests[0] }];
    const prevB = [{ ...s0.data.requests[1] }];
    let s = reducer(s0, { type: 'mutateStart', mutation: pending({ id: 'm1', requestIds: ['a'], previous: prevA, label: 'Marked done' }), apply: mutations.status('done', 'Dana', AT) });
    s = reducer(s, { type: 'mutateStart', mutation: pending({ id: 'm2', requestIds: ['b'], previous: prevB, label: 'Marked urgent' }), apply: mutations.priority('urgent', 'Dana', AT) });
    assert.equal(s.pending.length, 2);

    s = reducer(s, { type: 'mutateFail', id: 'm1', message: 'nope' });
    assert.equal(byId(s, 'a').status, 'new', 'the failed one rolled back');
    assert.equal(byId(s, 'b').priority, 'urgent', 'the other one is still applied');
    assert.equal(s.pending.length, 1);
  });

  it('records what a successful change touched, so the view can say where the rows went', () => {
    let s = base();
    s = reducer(s, { type: 'mutateStart', mutation: pending({ requestIds: ['a', 'b'], previous: [], label: 'Marked cancelled' }), apply: mutations.status('cancelled', 'Dana', AT) });
    assert.equal(s.lastResult, null, 'nothing is recorded until it has actually saved');
    s = reducer(s, { type: 'mutateOk', id: 'm1' });
    assert.deepEqual(s.lastResult, { label: 'Marked cancelled', requestIds: ['a', 'b'] });
  });

  it('records nothing when the change failed, because nothing moved', () => {
    let s = base();
    s = reducer(s, { type: 'mutateStart', mutation: pending({ requestIds: ['a'], previous: [{ ...base().data.requests[0] }] }), apply: mutations.status('done', 'Dana', AT) });
    s = reducer(s, { type: 'mutateFail', id: 'm1', message: 'nope' });
    assert.equal(s.lastResult, null);
  });

  it('drops the previous result when a new change starts, and on dismiss', () => {
    let s = base();
    s = reducer(s, { type: 'mutateStart', mutation: pending({ requestIds: ['a'], previous: [] }), apply: mutations.status('done', 'Dana', AT) });
    s = reducer(s, { type: 'mutateOk', id: 'm1' });
    assert.ok(s.lastResult);
    s = reducer(s, { type: 'mutateStart', mutation: pending({ id: 'm2', requestIds: ['b'], previous: [] }), apply: mutations.status('done', 'Dana', AT) });
    assert.equal(s.lastResult, null, 'a stale banner must not survive into the next action');
    s = reducer(s, { type: 'mutateOk', id: 'm2' });
    assert.equal(reducer(s, { type: 'dismissResult' }).lastResult, null);
  });

  it('clears the error banner on demand and on the next attempt', () => {
    let s = reducer(base(), { type: 'mutateFail', id: 'missing', message: 'boom' });
    assert.equal(s.lastError, 'boom');
    assert.equal(reducer(s, { type: 'dismissError' }).lastError, null);
    const next = reducer(s, { type: 'mutateStart', mutation: pending({ requestIds: ['a'], previous: [] }), apply: mutations.status('done', 'Dana', AT) });
    assert.equal(next.lastError, null);
  });
});

describe('mutation builders', () => {
  it('records a status change in the timeline', () => {
    const r = mutations.status('done', 'Dana', AT)(make({ id: 'a', status: 'new' }));
    assert.equal(r.status, 'done');
    assert.equal(r.updatedAt, AT);
    assert.equal(r.events.at(-1)!.kind, 'status_changed');
    assert.equal(r.events.at(-1)!.note, 'done');
    assert.equal(r.events.at(-1)!.by, 'Dana');
  });

  it('distinguishes assigning from unassigning', () => {
    const on = mutations.assign('c1', 'Halvorsen Plumbing', 'Dana', AT)(make());
    assert.equal(on.events.at(-1)!.kind, 'assigned');
    assert.equal(on.events.at(-1)!.note, 'Halvorsen Plumbing');
    const off = mutations.assign(null, '', 'Dana', AT)(on);
    assert.equal(off.contractorId, null);
    assert.equal(off.events.at(-1)!.kind, 'unassigned');
  });

  it('calls the second booking a reschedule, not a booking', () => {
    const first = mutations.schedule('2026-09-22', 'Dana', AT)(make({ status: 'triaged' }));
    assert.equal(first.events.at(-1)!.kind, 'scheduled');
    assert.equal(first.status, 'scheduled', 'booking a triaged request moves it along');
    const second = mutations.schedule('2026-09-24', 'Dana', AT)(first);
    assert.equal(second.events.at(-1)!.kind, 'rescheduled');
  });

  it('does not drag a finished request backwards when a date is set', () => {
    const done = mutations.schedule('2026-09-22', 'Dana', AT)(make({ status: 'done' }));
    assert.equal(done.status, 'done');
  });

  it('leaves the original object untouched', () => {
    const before = make({ id: 'a', status: 'new' });
    const snapshot = JSON.stringify(before);
    mutations.status('done', 'Dana', AT)(before);
    assert.equal(JSON.stringify(before), snapshot);
  });
});

describe('notes', () => {
  it('adds a timeline entry without changing any field', () => {
    const before = make({ id: 'a', status: 'triaged', priority: 'urgent', contractorId: 'c1' });
    const after = mutations.note('Tenant says it is worse this morning.', 'Dana', AT)(before);
    assert.equal(after.status, before.status);
    assert.equal(after.priority, before.priority);
    assert.equal(after.contractorId, before.contractorId);
    assert.equal(after.scheduledFor, before.scheduledFor);
    assert.equal(after.events.length, before.events.length + 1);
    assert.equal(after.events.at(-1)!.kind, 'note');
    assert.equal(after.events.at(-1)!.note, 'Tenant says it is worse this morning.');
    assert.equal(after.updatedAt, AT, 'a note still counts as activity');
  });
});
