import { buildDataset } from '../lib/seed.js';
import type { Dataset } from '../lib/types.js';

/**
 * Stands in for a server. Everything a real client has to cope with is here on
 * purpose: latency, failures, and a store that has to be read and written.
 *
 * The failure rate is a knob rather than a constant so the error and rollback
 * paths can be demonstrated on demand instead of being described.
 */

const STORAGE_KEY = 'keyset.dataset.v1';
const SEED_KEY = 'keyset.seededAt';

export interface ApiOptions {
  /** Artificial round trip, in milliseconds. */
  latency: number;
  /** 0 to 1. Mutations roll against this and reject when they lose. */
  failureRate: number;
}

export const DEFAULT_OPTIONS: ApiOptions = { latency: 450, failureRate: 0 };

let options: ApiOptions = { ...DEFAULT_OPTIONS };

export function setApiOptions(next: Partial<ApiOptions>): void {
  options = { ...options, ...next };
}

export function getApiOptions(): ApiOptions {
  return { ...options };
}

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A little jitter, so the loading state does not look like a fixed animation. */
function roundTrip(): Promise<void> {
  const base = options.latency;
  return wait(base * (0.6 + Math.random() * 0.8)) as Promise<void>;
}

function readStore(): Dataset | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Dataset;
    // Anything shaped wrong is discarded rather than crashing the app on load.
    if (!parsed || !Array.isArray(parsed.requests) || !parsed.requests.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStore(data: Dataset): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Quota or private mode. The session still works, it just will not persist.
  }
}

/** The moment the demo data is anchored to. Frozen on first visit so ages and
 *  the week board stay consistent instead of drifting between reloads. */
function seededAt(): number {
  try {
    const raw = localStorage.getItem(SEED_KEY);
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n)) return n;
    }
  } catch {}
  const now = Date.now();
  try { localStorage.setItem(SEED_KEY, String(now)); } catch {}
  return now;
}

export async function fetchDataset(): Promise<Dataset> {
  await roundTrip();
  const stored = readStore();
  if (stored) return stored;
  const fresh = buildDataset(seededAt());
  writeStore(fresh);
  return fresh;
}

/** Mutations do not send a diff; the client hands back the whole set it now
 *  believes in, the way a small app with a single writer reasonably would. */
export async function saveDataset(data: Dataset): Promise<void> {
  await roundTrip();
  if (Math.random() < options.failureRate) {
    throw new ApiError('The server rejected that change. Nothing was saved.');
  }
  writeStore(data);
}

/** Wipes the visitor's changes and rebuilds from the seed. */
export async function resetDataset(): Promise<Dataset> {
  await roundTrip();
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SEED_KEY);
  } catch {}
  const fresh = buildDataset(seededAt());
  writeStore(fresh);
  return fresh;
}
