export const MODE_KEY = 'stepcalc.mode.v1';
export const ANGLE_KEY = 'stepcalc.angle.v1';

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): KeyValueStorage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

/** A saved choice, or the fallback when nothing valid is stored or storage is blocked. */
export function loadPref<T extends string>(key: string, allowed: readonly T[], fallback: T, storage = defaultStorage()): T {
  try {
    const value = storage?.getItem(key);
    return allowed.includes(value as T) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

export function savePref(key: string, value: string, storage = defaultStorage()): void {
  try {
    storage?.setItem(key, value);
  } catch {
    // Not remembered, but the app keeps working.
  }
}

export const UNITS_KEY = 'stepcalc.units.v1';

/** A saved JSON value that passes `isValid`, else the fallback. */
export function loadJson<T>(key: string, isValid: (value: unknown) => value is T, fallback: T, storage = defaultStorage()): T {
  try {
    const value: unknown = JSON.parse(storage?.getItem(key) ?? 'null');
    return isValid(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown, storage = defaultStorage()): void {
  savePref(key, JSON.stringify(value), storage);
}
