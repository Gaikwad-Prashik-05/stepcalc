import { describe, expect, it } from 'vitest';
import { PointCloudRecognizer, type Stroke } from './recognizer';
import { BUILT_IN_TEMPLATES, GLYPHS } from './templates';

/** Deterministic random numbers so failures repeat. */
function random(seed: number) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

/** A glyph drawn the way a person might: any size and place, slightly slanted, with a shaky hand. */
function drawn(strokes: Stroke[], r: () => number): Stroke[] {
  const size = 40 + r() * 80;
  const [dx, dy] = [r() * 300, r() * 200];
  const slant = (r() - 0.5) * 0.3;
  const stretch = 0.85 + r() * 0.3;
  return strokes.map((s) => s.map((pt) => ({
    x: dx + (pt.x * stretch + slant * pt.y) * size + (r() - 0.5) * size * 0.04,
    y: dy + pt.y * size + (r() - 0.5) * size * 0.04,
  })));
}

describe('PointCloudRecognizer', () => {
  const recognizer = new PointCloudRecognizer(BUILT_IN_TEMPLATES);

  it('reads its own templates back exactly', () => {
    // Look-alikes (1/l, 0/o) tie; the layout step offers both readings.
    for (const t of BUILT_IN_TEMPLATES) {
      const alternatives = recognizer.recognize(t.strokes);
      expect(alternatives.find((a) => a.label === t.label)!.distance, t.label).toBeCloseTo(alternatives[0].distance, 6);
    }
  });

  it('reads at least 90% of shaky, scaled, slanted digits', () => {
    const r = random(42);
    let right = 0;
    let total = 0;
    for (let round = 0; round < 10; round++) {
      for (const digit of '0123456789') {
        for (const variant of GLYPHS[digit]) {
          total++;
          if (recognizer.recognize(drawn(variant, r))[0].label === digit) right++;
        }
      }
    }
    expect(right / total).toBeGreaterThanOrEqual(0.9);
  }, 30_000); // 170 recognitions; slow only when the whole suite shares the CPU

  it('does not care about stroke order or direction', () => {
    const plus = GLYPHS['+'][0];
    const reversed = [...plus].reverse().map((s) => [...s].reverse());
    expect(recognizer.recognize(reversed)[0].label).toBe('+');
  });

  it('prefers what the user taught', () => {
    // A user who writes 7 with a curly top: built-ins would not call this a 7.
    const curly: Stroke[] = [[{ x: 0, y: 0.2 }, { x: 0.2, y: 0 }, { x: 0.45, y: 0.1 }, { x: 0.6, y: 0 }, { x: 0.3, y: 1 }]];
    const taught = new PointCloudRecognizer(BUILT_IN_TEMPLATES);
    taught.add('7', curly);
    expect(taught.recognize(drawn(curly, random(3)))[0].label).toBe('7');
  });

  it('returns nothing for no ink, and a ranked list otherwise', () => {
    expect(recognizer.recognize([])).toEqual([]);
    const alternatives = recognizer.recognize(GLYPHS['8'][0]);
    expect(new Set(alternatives.map((a) => a.label)).size).toBe(alternatives.length);
    expect(alternatives.every((a, i) => i === 0 || a.distance >= alternatives[i - 1].distance)).toBe(true);
  });
});
