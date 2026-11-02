import { describe, expect, it } from 'vitest';
import { addEntry, clearHistory, groupByDay, MAX_HISTORY, type HistoryEntry } from './history';

const local = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).toISOString();
const entry = (expression: string, at: string): HistoryEntry => ({ expression, result: '1', exact: '1', at });

describe('history', () => {
  it('adds newest first without mutating the input', () => {
    const first = addEntry([], entry('1+1', local(2026, 11, 3)));
    const second = addEntry(first, entry('2+2', local(2026, 11, 3)));
    expect(second.map((e) => e.expression)).toEqual(['2+2', '1+1']);
    expect(first).toHaveLength(1);
  });

  it(`keeps at most ${MAX_HISTORY} entries, dropping the oldest`, () => {
    let entries: HistoryEntry[] = [];
    for (let i = 0; i < MAX_HISTORY + 5; i++) entries = addEntry(entries, entry(`${i}`, local(2026, 11, 3)));
    expect(entries).toHaveLength(MAX_HISTORY);
    expect(entries[0].expression).toBe(`${MAX_HISTORY + 4}`);
    expect(entries.at(-1)?.expression).toBe('5');
  });

  it('clears', () => {
    expect(clearHistory()).toEqual([]);
  });

  it('groups by local day: Today, then YYYY.MM.DD, newest group first', () => {
    const now = new Date(2026, 10, 3, 9, 0);
    const entries = [
      entry('today', local(2026, 11, 3, 0, 1)),
      entry('late', local(2026, 11, 2, 23, 59)),
      entry('early', local(2026, 11, 2, 0, 0)),
      entry('old', local(2026, 10, 25)),
    ];
    expect(groupByDay(entries, now)).toEqual([
      { label: 'Today', entries: [entries[0]] },
      { label: '2026.11.02', entries: [entries[1], entries[2]] },
      { label: '2026.10.25', entries: [entries[3]] },
    ]);
  });

  it('returns no groups for empty history', () => {
    expect(groupByDay([], new Date())).toEqual([]);
  });
});
