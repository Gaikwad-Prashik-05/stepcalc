import { describe, expect, it } from 'vitest';
import type { HistoryEntry } from '../core/history';
import { HISTORY_KEY, loadHistory, saveHistory } from './history-store';

class FakeStorage {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
}
const throwing = {
  getItem(): string | null { throw new Error('SecurityError'); },
  setItem(): void { throw new Error('QuotaExceededError'); },
};
const sample: HistoryEntry[] = [{ expression: '1+1', result: '2', exact: '2', at: '2026-11-03T10:30:00.000Z' }];

describe('history-store', () => {
  it('round-trips entries under a versioned key', () => {
    const storage = new FakeStorage();
    saveHistory(sample, storage);
    expect(HISTORY_KEY).toBe('stepcalc.history.v1');
    expect(loadHistory(storage)).toEqual(sample);
  });

  it.each([
    ['missing key', null],
    ['corrupted JSON', '{not json'],
    ['not an array', '{"a":1}'],
    ['wrong entry shape', '[{"expression":1}]'],
  ])('returns [] for %s', (_name, raw) => {
    const storage = new FakeStorage();
    if (raw !== null) storage.setItem(HISTORY_KEY, raw);
    expect(loadHistory(storage)).toEqual([]);
  });

  it('drops only malformed entries, keeps valid ones', () => {
    const storage = new FakeStorage();
    storage.setItem(HISTORY_KEY, JSON.stringify([...sample, { nope: true }]));
    expect(loadHistory(storage)).toEqual(sample);
  });

  it('never throws when storage is blocked or full', () => {
    expect(loadHistory(throwing)).toEqual([]);
    expect(() => saveHistory(sample, throwing)).not.toThrow();
  });

  it('returns [] when no storage is available at all', () => {
    expect(loadHistory(undefined)).toEqual([]);
    expect(() => saveHistory(sample, undefined)).not.toThrow();
  });
});
