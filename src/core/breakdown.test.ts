import { describe, expect, it } from 'vitest';
import { calculate } from './engine';
import { workingFor, type Working } from './breakdown';

function breakdown(expression: string, ans?: string) {
  const w = workingFor(expression, ans);
  if (w?.kind !== 'breakdown') throw new Error(`expected a breakdown for ${expression}, got ${w?.kind}`);
  return w;
}
const lines = (w: Extract<Working, { kind: 'breakdown' }>) => w.steps.map((s) => s.line);
const ops = (w: Extract<Working, { kind: 'breakdown' }>) => w.steps.map((s) => s.op);

describe('workingFor: BODMAS breakdown', () => {
  it('multiplies before adding', () => {
    const w = breakdown('5 + 3 × 2');
    expect(w.start).toBe('5 + 3 × 2');
    expect(lines(w)).toEqual(['= 5 + 6', '= 11']);
    expect(ops(w)).toEqual(['3 × 2 = 6', '5 + 6 = 11']);
    expect(w.steps.every((s) => s.detail)).toBe(true);
  });

  it('does every × and ÷ before any + even when + comes first', () => {
    expect(ops(breakdown('2 + 3 + 4 × 5'))).toEqual(['4 × 5 = 20', '2 + 3 = 5', '5 + 20 = 25']);
  });

  it('brackets first, then orders', () => {
    const w = breakdown('(2 + 3) × 4 + 2 ^ 3');
    expect(lines(w)).toEqual(['= 5 × 4 + 2 ^ 3', '= 5 × 4 + 8', '= 20 + 8', '= 28']);
    expect(w.steps[1].detail).toBeNull(); // no column working for powers
  });

  it('works left to right for equal priority', () => {
    expect(lines(breakdown('10 − 2 − 3'))).toEqual(['= 8 − 3', '= 5']);
    expect(lines(breakdown('48 ÷ 4 × 2'))).toEqual(['= 12 × 2', '= 24']);
  });

  it('brackets negative results', () => {
    expect(lines(breakdown('1 − (2 − 5)'))).toEqual(['= 1 − (−3)', '= 4']);
  });

  it('shows Ans as its value', () => {
    const w = breakdown('Ans × 2 + 1', '15');
    expect(w.start).toBe('15 × 2 + 1');
    expect(lines(w)).toEqual(['= 30 + 1', '= 31']);
  });

  it('rounded intermediate values get no column working', () => {
    const w = breakdown('1 ÷ 3 + 1');
    expect(w.steps[0].op).toBe('1 ÷ 3 = 0.333333333333');
    expect(w.steps[1].detail).toBeNull();
  });
});

describe('workingFor: single operation', () => {
  it('goes straight to the column working', () => {
    const w = workingFor('37270 − 11359');
    expect(w?.kind).toBe('grid');
  });

  it('works with Ans', () => {
    const w = workingFor('Ans + 5', '10');
    expect(w?.kind === 'grid' && w.grid.label).toBe('Column addition: 10 plus 5 equals 15');
  });

  it.each(['', '5', '50 + 10%', '2 ^ 3', '1 ÷ 0', 'abc'])('no working for %s', (e) => {
    expect(workingFor(e)).toBeNull();
  });
});

describe('workingFor agrees with the engine', () => {
  const rand = (seed: { s: number }) => (seed.s = (seed.s * 16807) % 2147483647) / 2147483647;
  it('for 1000 random mixed expressions', () => {
    const seed = { s: 99 };
    const r = () => rand(seed);
    const opsList = ['+', '−', '×', '÷'];
    for (let i = 0; i < 1000; i++) {
      let expr = String(Math.floor(r() * 1000));
      const count = 2 + Math.floor(r() * 4);
      for (let k = 0; k < count; k++) expr += ` ${opsList[Math.floor(r() * 4)]} ${1 + Math.floor(r() * 99)}`;
      if (r() < 0.3) expr = `(${expr}) × 2`;
      const engine = calculate(expr);
      if (!engine.ok) continue;
      const w = workingFor(expr);
      expect(w?.kind, expr).toBe('breakdown');
    }
  });
});
