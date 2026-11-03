import { describe, expect, it } from 'vitest';
import { loadPref, savePref } from './prefs';

const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
};

describe('prefs', () => {
  it('round-trips a saved choice', () => {
    const s = memory();
    savePref('k', 'rad', s);
    expect(loadPref('k', ['deg', 'rad'], 'deg', s)).toBe('rad');
  });

  it('falls back on missing, unknown or blocked storage', () => {
    const s = memory();
    expect(loadPref('k', ['deg', 'rad'], 'deg', s)).toBe('deg');
    s.setItem('k', 'grad');
    expect(loadPref('k', ['deg', 'rad'], 'deg', s)).toBe('deg');
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(loadPref('k', ['deg', 'rad'], 'deg', blocked)).toBe('deg');
    expect(() => savePref('k', 'rad', blocked)).not.toThrow();
  });
});
