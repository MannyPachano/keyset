import { CATEGORIES, type Category, type Dataset, type MaintenanceRequest,
         type Priority, type RequestEvent, type Status } from './types.js';

/** Deterministic PRNG, so every visitor sees the same demo and the tests are
 *  reproducible. mulberry32: small, fast, good enough for fake data. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PROPERTY_NAMES = [
  ['Ashgrove Court', 'Portland'], ['Marlow House', 'Portland'], ['The Beckett', 'Salem'],
  ['Halloway Flats', 'Eugene'], ['Cedar Row', 'Portland'],
];

const FIRST = ['Dana','Marcus','Priya','Tom','Lena','Osman','Ruth','Kai','Nadia','Grant','Elise','Bo','Iris','Hugo','Mina','Sol','Vera','Theo','Nia','Rafe'];
const LAST = ['Whitfield','Okonkwo','Baranov','Cortez','Lindqvist','Hale','Duarte','Petrov','Nakamura','Abara','Finch','Rossi','Mbeki','Kowalski','Sorensen'];

const CONTRACTORS: [string, Category][] = [
  ['Halvorsen Plumbing', 'plumbing'], ['Bright Line Electric', 'electrical'],
  ['Northgate Heating', 'heating'], ['Apex Appliance', 'appliance'],
  ['Stonemark Builders', 'structural'], ['Clearfield Pest', 'pest'],
  ['Ridgeway Facilities', 'common_area'], ['Two Rivers Handyman', 'other'],
];

/** Title and detail per category, so the queue reads like real work rather
 *  than lorem ipsum. Each entry is [title, detail]. */
const ISSUES: Record<Category, [string, string][]> = {
  plumbing: [
    ['Kitchen sink draining slowly', 'Water backs up and takes about ten minutes to clear. Started on Monday.'],
    ['Toilet running constantly', 'It will not stop filling unless the handle is jiggled.'],
    ['No hot water in the shower', 'Cold only since this morning. The kitchen tap is fine.'],
    ['Leak under the bathroom sink', 'A steady drip into the cabinet. I have put a bowl under it.'],
  ],
  electrical: [
    ['Outlet in the bedroom is dead', 'Nothing works in the socket by the window. The others on that wall are fine.'],
    ['Hallway light flickers', 'It flickers for a few seconds whenever it is switched on.'],
    ['Breaker trips when the microwave runs', 'Happens most times if the kettle is on as well.'],
  ],
  heating: [
    ['Radiator cold in the front room', 'The rest of the flat heats up, that one stays cold.'],
    ['Thermostat not responding', 'The screen is blank and the heating will not come on.'],
    ['Boiler making a knocking sound', 'A regular knock when the heating starts, roughly every second.'],
  ],
  appliance: [
    ['Fridge not staying cold', 'Milk is spoiling within a day. The freezer seems fine.'],
    ['Oven does not reach temperature', 'It takes over an hour to get to 180 and never gets hotter.'],
    ['Washing machine will not drain', 'It stops mid cycle with water still in the drum.'],
  ],
  structural: [
    ['Damp patch on the bedroom ceiling', 'About the size of a dinner plate and it has grown since last week.'],
    ['Window will not close fully', 'There is a gap at the top and the room is cold.'],
    ['Loose handrail on the back stairs', 'It moves when you put weight on it.'],
  ],
  pest: [
    ['Mice in the kitchen', 'Droppings behind the cooker and noise at night.'],
    ['Ants along the skirting board', 'A steady line from the back door to the cupboard.'],
  ],
  common_area: [
    ['Entry door not latching', 'It sits open unless you pull it hard. Anyone can walk in.'],
    ['Bin store light out', 'Completely dark after about five in the afternoon.'],
    ['Lift stopping between floors', 'It jolted and stopped for a minute before moving again.'],
  ],
  other: [
    ['Key fob stopped working', 'It will not open the main door. The spare works.'],
    ['Buzzer not connecting', 'Visitors press it and nothing rings inside.'],
  ],
};

const STATUS_FLOW: Status[] = ['new', 'triaged', 'scheduled', 'in_progress', 'done'];

function pick<T>(r: () => number, xs: T[]): T { return xs[Math.floor(r() * xs.length)]; }

/**
 * Builds the demo dataset. `now` is injected rather than read from the clock so
 * tests are stable and the seed can be regenerated relative to any moment.
 */
export function buildDataset(now: number, seed = 20260920, count = 200): Dataset {
  const r = rng(seed);

  const properties = PROPERTY_NAMES.map(([name, city], i) => ({
    id: `p${i + 1}`, name, city, unitCount: 0,
  }));

  const units: Dataset['units'] = [];
  const tenants: Dataset['tenants'] = [];
  properties.forEach((prop, pi) => {
    const floors = 3 + Math.floor(r() * 3);
    const perFloor = 3 + Math.floor(r() * 3);
    for (let f = 1; f <= floors; f++) {
      for (let n = 0; n < perFloor; n++) {
        const label = `${f}${String.fromCharCode(65 + n)}`;
        const id = `u${pi + 1}-${label}`;
        units.push({ id, propertyId: prop.id, label });
        tenants.push({
          id: `t${units.length}`,
          unitId: id,
          name: `${pick(r, FIRST)} ${pick(r, LAST)}`,
          phone: `(503) 555-${String(100 + Math.floor(r() * 900))}`,
        });
      }
    }
    prop.unitCount = units.filter((u) => u.propertyId === prop.id).length;
  });

  const contractors = CONTRACTORS.map(([name, trade], i) => ({
    id: `c${i + 1}`, name, trade,
    phone: `(503) 555-${String(100 + Math.floor(r() * 900))}`,
  }));

  const requests: MaintenanceRequest[] = [];
  for (let i = 0; i < count; i++) {
    const unit = pick(r, units);
    const tenant = tenants.find((t) => t.unitId === unit.id)!;
    const category = pick(r, CATEGORIES);
    const [title, detail] = pick(r, ISSUES[category]);

    // Weighted so most work is routine and emergencies are rare, like real life.
    const roll = r();
    const priority: Priority = roll < 0.08 ? 'emergency' : roll < 0.34 ? 'urgent' : 'routine';

    // Most work is recent, with a tail going back about six weeks.
    const ageDays = Math.pow(r(), 1.7) * 45;
    const createdAt = new Date(now - ageDays * 86400_000);
    // Work closes as it ages. Without this the queue fills with month-old open
    // requests and almost everything reads as overdue, which looks like a broken
    // demo rather than a busy week.
    const progress = Math.min(STATUS_FLOW.length - 1, Math.floor(Math.pow(r(), 0.45) * (1 + ageDays / 2.2)));
    let status: Status = STATUS_FLOW[progress];
    if (r() < 0.04) status = 'cancelled';

    const assigned = status !== 'new' && status !== 'cancelled' && r() > 0.12;
    const matching = contractors.filter((c) => c.trade === category);
    const contractorId = assigned ? (matching.length ? matching[0].id : pick(r, contractors).id) : null;

    const scheduled = ['scheduled', 'in_progress', 'done'].includes(status);
    // Finished jobs were visited somewhere inside their own lifetime; upcoming
    // ones are booked across the next fortnight. Bunching them all into the
    // current week would leave the board unreadable.
    const offset = status === 'done'
      ? -Math.floor(r() * Math.max(1, Math.min(ageDays, 30)))
      : Math.floor(r() * 18) - 3;
    const scheduledFor = scheduled ? isoDayLocal(new Date(now + offset * 86400_000)) : null;

    const events: RequestEvent[] = [
      { id: `${i}-0`, at: createdAt.toISOString(), kind: 'opened', by: tenant.name },
    ];
    let cursor = createdAt.getTime();
    const step = () => { cursor += (0.3 + r() * 2.5) * 86400_000; return new Date(Math.min(cursor, now)).toISOString(); };
    if (progress >= 1 && status !== 'cancelled') events.push({ id: `${i}-1`, at: step(), kind: 'triaged', by: 'Dana Whitfield' });
    if (contractorId) events.push({ id: `${i}-2`, at: step(), kind: 'assigned', by: 'Dana Whitfield', note: contractors.find((c) => c.id === contractorId)!.name });
    if (scheduledFor) events.push({ id: `${i}-3`, at: step(), kind: 'scheduled', by: 'Dana Whitfield', note: scheduledFor });
    if (status === 'done') events.push({ id: `${i}-4`, at: step(), kind: 'status_changed', by: 'Dana Whitfield', note: 'done' });
    if (status === 'cancelled') events.push({ id: `${i}-4`, at: step(), kind: 'status_changed', by: tenant.name, note: 'cancelled, tenant resolved it' });

    requests.push({
      id: `r${i + 1}`,
      ref: `MR-${1000 + i}`,
      unitId: unit.id,
      tenantId: tenant.id,
      title, detail, category, priority, status,
      createdAt: createdAt.toISOString(),
      updatedAt: events[events.length - 1].at,
      contractorId,
      scheduledFor,
      events,
    });
  }

  return { properties, units, tenants, contractors, requests };
}

function isoDayLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
