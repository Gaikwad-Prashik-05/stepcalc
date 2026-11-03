import { describe, expect, it } from 'vitest';
import { addSample, loadSamples, MAX_PER_SYMBOL, saveSamples, type Samples } from './samples';
import { GLYPHS } from './templates';

const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
};

describe('handwriting samples', () => {
  it('keeps samples small and round-trips them', () => {
    const s = memory();
    const samples: Samples = {};
    const big = GLYPHS['7'][1].map((stroke) => stroke.map((p) => ({ x: p.x * 500 + 0.123456, y: p.y * 500 })));
    const sample = addSample(samples, '7', big)!;
    expect(sample.flat()).toHaveLength(32);
    saveSamples(samples, s);
    expect(loadSamples(s)).toEqual(samples);
  });

  it('keeps only the newest samples per symbol', () => {
    const samples: Samples = {};
    for (let i = 0; i < MAX_PER_SYMBOL + 3; i++) addSample(samples, '1', [[{ x: 0, y: 0 }, { x: i + 1, y: 10 }]]);
    expect(samples['1']).toHaveLength(MAX_PER_SYMBOL);
  });

  it('refuses symbols that are not taught and drops bad data', () => {
    const samples: Samples = {};
    expect(addSample(samples, '=', [[{ x: 0, y: 0 }, { x: 1, y: 0 }]])).toBeNull();
    const s = memory();
    s.setItem('stepcalc.handwriting.v1', JSON.stringify({ '7': [[[{ x: 1, y: 2 }]], 'junk', []], hack: [[[{ x: 0, y: 0 }]]] }));
    expect(loadSamples(s)).toEqual({ '7': [[[{ x: 1, y: 2 }]]] });
    s.setItem('stepcalc.handwriting.v1', '{bad json');
    expect(loadSamples(s)).toEqual({});
  });
});
