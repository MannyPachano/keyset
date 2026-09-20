import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildDataset } from '../seed.js';
import { isOverdue, weekDays, isoDay } from '../dates.js';
import { CLOSED_STATUSES, STATUSES } from '../types.js';

const NOW = Date.parse('2026-09-20T12:00:00.000Z');
const data = buildDataset(NOW);

describe('the demo dataset', () => {
  it('is identical every time, so every visitor sees the same demo', () => {
    const again = buildDataset(NOW);
    assert.equal(JSON.stringify(data), JSON.stringify(again));
  });

  it('changes when the seed changes, so it is genuinely seeded and not hardcoded', () => {
    assert.notEqual(JSON.stringify(data), JSON.stringify(buildDataset(NOW, 12345)));
  });

  it('has the number of requests it was asked for, with unique ids and references', () => {
    assert.equal(data.requests.length, 200);
    assert.equal(new Set(data.requests.map((r) => r.id)).size, 200);
    assert.equal(new Set(data.requests.map((r) => r.ref)).size, 200);
  });

  it('never dangles a foreign key', () => {
    const units = new Set(data.units.map((u) => u.id));
    const tenants = new Set(data.tenants.map((t) => t.id));
    const contractors = new Set(data.contractors.map((c) => c.id));
    const properties = new Set(data.properties.map((p) => p.id));
    for (const u of data.units) assert.ok(properties.has(u.propertyId), u.id);
    for (const t of data.tenants) assert.ok(units.has(t.unitId), t.id);
    for (const r of data.requests) {
      assert.ok(units.has(r.unitId), r.ref);
      assert.ok(tenants.has(r.tenantId), r.ref);
      if (r.contractorId) assert.ok(contractors.has(r.contractorId), r.ref);
    }
  });

  it('puts the tenant in the unit the request came from', () => {
    const unitOfTenant = new Map(data.tenants.map((t) => [t.id, t.unitId]));
    for (const r of data.requests) assert.equal(unitOfTenant.get(r.tenantId), r.unitId, r.ref);
  });

  it('never books a visit for a request that has not got that far', () => {
    for (const r of data.requests) {
      if (r.scheduledFor) assert.ok(['scheduled', 'in_progress', 'done'].includes(r.status), `${r.ref} is ${r.status}`);
    }
  });

  it('keeps every timeline in order and inside the request lifetime', () => {
    for (const r of data.requests) {
      assert.ok(r.events.length > 0, r.ref);
      assert.equal(r.events[0].kind, 'opened');
      const times = r.events.map((e) => Date.parse(e.at));
      for (let i = 1; i < times.length; i++) assert.ok(times[i] >= times[i - 1], `${r.ref} event ${i} goes backwards`);
      assert.ok(times[0] >= Date.parse(r.createdAt) - 1, r.ref);
      assert.ok(times.at(-1)! <= NOW, `${r.ref} has an event in the future`);
      assert.equal(r.updatedAt, r.events.at(-1)!.at, `${r.ref} updatedAt does not match its last event`);
    }
  });

  it('never opens a request in the future', () => {
    for (const r of data.requests) assert.ok(Date.parse(r.createdAt) <= NOW, r.ref);
  });

  it('gives the queue something of everything to show', () => {
    const by = (k: string) => data.requests.filter((r) => r.status === k).length;
    for (const s of STATUSES) assert.ok(by(s) > 0, `no requests are ${s}, the demo would look thin`);

    const open = data.requests.filter((r) => !CLOSED_STATUSES.includes(r.status));
    const overdue = open.filter((r) => isOverdue(r, NOW));
    assert.ok(overdue.length >= 10, `only ${overdue.length} overdue, the late state would never be seen`);
    // A minority, not a majority. A queue where everything is late reads as a
    // broken demo rather than a busy week, and makes the overdue filter useless.
    assert.ok(overdue.length < open.length * 0.5,
      `${overdue.length} of ${open.length} open requests are overdue, which is too many to be believable`);
    assert.ok(open.length >= 60 && open.length <= 130,
      `${open.length} open requests: the default view should be a working queue, not empty and not endless`);

    const unassigned = open.filter((r) => !r.contractorId);
    assert.ok(unassigned.length >= 5, 'nothing to assign, so the bulk action has nothing to act on');

    const thisWeek = new Set(weekDays(isoDay(new Date(NOW))));
    const booked = data.requests.filter((r) => r.scheduledFor && thisWeek.has(r.scheduledFor));
    assert.ok(booked.length >= 10, `only ${booked.length} booked this week, the board would look empty`);
    assert.ok(booked.length <= 70, `${booked.length} booked into one week would leave the board unreadable`);

    assert.ok(data.requests.filter((r) => r.priority === 'emergency').length >= 5, 'no emergencies to show');
  });

  it('spreads work across every property and contractor', () => {
    for (const p of data.properties) {
      const unitIds = new Set(data.units.filter((u) => u.propertyId === p.id).map((u) => u.id));
      assert.ok(data.requests.some((r) => unitIds.has(r.unitId)), `${p.name} has no requests`);
    }
    const used = new Set(data.requests.map((r) => r.contractorId).filter(Boolean));
    assert.ok(used.size >= 4, `only ${used.size} contractors are ever used`);
  });
});
