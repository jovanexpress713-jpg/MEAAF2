import { Api } from './api';

// Offline outbox: operations made while disconnected are stored locally, then pushed to the
// server. The server answers per operation (applied / conflict / rejected); every answer clears
// the operation from the outbox, and conflicts/rejections are kept so the user can review them.

const KEYS = {
  outbox: 'MEAAF_OUTBOX',
  conflicts: 'MEAAF_SYNC_CONFLICTS',
  patients: 'MEAAF_PATIENT_CACHE',
  device: 'MEAAF_DEVICE_ID',
} as const;

export const SYNC_EVENT = 'meaaf-sync-changed';

export interface OutboxOp {
  opId: string;
  type: 'patient.create';
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface SyncIssue {
  opId: string;
  status: 'conflict' | 'rejected';
  message: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(SYNC_EVENT));
}

function randomId(prefix: string): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `${prefix}-${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')}`;
}

export function getDeviceId(): string {
  let id = localStorage.getItem(KEYS.device);
  if (!id) {
    id = randomId('dev');
    localStorage.setItem(KEYS.device, id);
  }
  return id;
}

export function getOutbox(): OutboxOp[] {
  return read<OutboxOp[]>(KEYS.outbox, []);
}

export function getIssues(): SyncIssue[] {
  return read<SyncIssue[]>(KEYS.conflicts, []);
}

export function enqueuePatient(payload: Record<string, unknown>): OutboxOp {
  const op: OutboxOp = { opId: randomId('op'), type: 'patient.create', payload, createdAt: new Date().toISOString() };
  write(KEYS.outbox, [...getOutbox(), op]);
  return op;
}

export function dismissIssue(opId: string) {
  write(KEYS.conflicts, getIssues().filter(i => i.opId !== opId));
}

export function cachePatients(patients: unknown[]) {
  localStorage.setItem(KEYS.patients, JSON.stringify({ savedAt: new Date().toISOString(), patients }));
}

export function getCachedPatients(): { savedAt: string | null; patients: any[] } {
  const cached = read<{ savedAt: string; patients: any[] } | null>(KEYS.patients, null);
  return cached ? { savedAt: cached.savedAt, patients: cached.patients } : { savedAt: null, patients: [] };
}

// True when a request failed because the network is unavailable (not a server answer).
export function isNetworkError(err: unknown): boolean {
  return (typeof navigator !== 'undefined' && !navigator.onLine) || err instanceof TypeError;
}

export interface FlushResult {
  offline: boolean;
  applied: number;
  conflicts: number;
  rejected: number;
  remaining: number;
}

let flushing: Promise<FlushResult> | null = null;

// Pushes queued operations in batches. Concurrent calls share one run.
export function flushOutbox(): Promise<FlushResult> {
  if (!flushing) {
    flushing = doFlush().finally(() => {
      flushing = null;
    });
  }
  return flushing;
}

async function doFlush(): Promise<FlushResult> {
  const result: FlushResult = { offline: false, applied: 0, conflicts: 0, rejected: 0, remaining: getOutbox().length };
  const deviceId = getDeviceId();

  while (getOutbox().length > 0) {
    const batch = getOutbox().slice(0, 200);
    let response;
    try {
      response = await Api.syncPush(deviceId, batch.map(o => ({ opId: o.opId, type: o.type, payload: o.payload })));
    } catch (err) {
      if (isNetworkError(err)) {
        result.offline = true;
        break;
      }
      // Server refused the whole batch (e.g. session expired). Keep the outbox for a later retry.
      throw err;
    }

    const answered = new Map(response.results.map(r => [r.opId, r]));
    const issues = getIssues();
    for (const op of batch) {
      const r = answered.get(op.opId);
      if (!r) continue; // no answer: keep it queued
      if (r.status === 'applied') {
        result.applied++;
      } else {
        const status = r.status === 'conflict' ? 'conflict' : 'rejected';
        status === 'conflict' ? result.conflicts++ : result.rejected++;
        issues.push({ opId: op.opId, status, message: r.message, payload: op.payload, createdAt: new Date().toISOString() });
      }
    }
    const answeredIds = new Set(batch.filter(op => answered.has(op.opId)).map(op => op.opId));
    write(KEYS.conflicts, issues);
    write(KEYS.outbox, getOutbox().filter(o => !answeredIds.has(o.opId)));
    if (answeredIds.size === 0) break;
  }

  result.remaining = getOutbox().length;
  return result;
}
