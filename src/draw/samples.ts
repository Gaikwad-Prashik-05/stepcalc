import { compact, type Stroke } from './recognizer';
import { TEACHABLE } from './templates';

export const HANDWRITING_KEY = 'stepcalc.handwriting.v1';
export const MAX_PER_SYMBOL = 12;

/** The user's own handwriting: symbol → samples, each a list of strokes. */
export type Samples = Record<string, Stroke[][]>;

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): KeyValueStorage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

const isPoint = (p: unknown) => typeof (p as { x: unknown })?.x === 'number' && typeof (p as { y: unknown })?.y === 'number';
const isSample = (s: unknown) => Array.isArray(s) && s.length > 0 && s.every((stroke) => Array.isArray(stroke) && stroke.every(isPoint));

/** What the Teach screen and corrections saved; anything malformed is dropped. */
export function loadSamples(storage: KeyValueStorage | undefined = defaultStorage()): Samples {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(HANDWRITING_KEY) ?? '{}');
    if (typeof parsed !== 'object' || parsed === null) return {};
    const samples: Samples = {};
    for (const [label, list] of Object.entries(parsed)) {
      if (TEACHABLE.includes(label) && Array.isArray(list)) samples[label] = list.filter(isSample).slice(-MAX_PER_SYMBOL);
    }
    return samples;
  } catch {
    return {};
  }
}

export function saveSamples(samples: Samples, storage: KeyValueStorage | undefined = defaultStorage()): void {
  try {
    storage?.setItem(HANDWRITING_KEY, JSON.stringify(samples));
  } catch {
    // Full or blocked: the sample still helps for this visit.
  }
}

/** Adds a sample (compacted), keeping the newest MAX_PER_SYMBOL; returns the compacted sample, or null if not teachable. */
export function addSample(samples: Samples, label: string, strokes: Stroke[]): Stroke[] | null {
  if (!TEACHABLE.includes(label) || !strokes.length) return null;
  const sample = compact(strokes);
  samples[label] = [...(samples[label] ?? []), sample].slice(-MAX_PER_SYMBOL);
  return sample;
}
