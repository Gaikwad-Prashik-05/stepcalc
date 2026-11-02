export interface HistoryEntry {
  expression: string;
  result: string;
  exact: string;
  /** ISO 8601 UTC, e.g. "2026-11-03T10:30:00.000Z"; grouped by the viewer's local day. */
  at: string;
}

export interface HistoryGroup {
  label: string;
  entries: HistoryEntry[];
}

export const MAX_HISTORY = 200;

export function addEntry(entries: readonly HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  return [entry, ...entries].slice(0, MAX_HISTORY);
}

export function clearHistory(): HistoryEntry[] {
  return [];
}

function dayLabel(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

/** Entries must be newest first (as addEntry keeps them); groups come out newest first. */
export function groupByDay(entries: readonly HistoryEntry[], now: Date): HistoryGroup[] {
  const today = dayLabel(now);
  const groups: HistoryGroup[] = [];
  for (const entry of entries) {
    const day = dayLabel(new Date(entry.at));
    const label = day === today ? 'Today' : day;
    const last = groups.at(-1);
    if (last?.label === label) last.entries.push(entry);
    else groups.push({ label, entries: [entry] });
  }
  return groups;
}
