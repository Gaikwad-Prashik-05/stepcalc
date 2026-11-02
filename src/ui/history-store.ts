import type { HistoryEntry } from '../core/history';

export const HISTORY_KEY = 'stepcalc.history.v1';

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

// localStorage itself can throw on access (blocked site data), so resolve it lazily and safely.
function defaultStorage(): KeyValueStorage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function isEntry(value: unknown): value is HistoryEntry {
  const e = value as Record<string, unknown> | null;
  return (
    typeof e === 'object' && e !== null &&
    typeof e.expression === 'string' && typeof e.result === 'string' &&
    typeof e.exact === 'string' && typeof e.at === 'string'
  );
}

export function loadHistory(storage: KeyValueStorage | undefined = defaultStorage()): HistoryEntry[] {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(HISTORY_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entries: readonly HistoryEntry[], storage: KeyValueStorage | undefined = defaultStorage()): void {
  try {
    storage?.setItem(HISTORY_KEY, JSON.stringify(entries));
  } catch {
    // Storage blocked or full: the app keeps working, history just isn't persisted.
  }
}
