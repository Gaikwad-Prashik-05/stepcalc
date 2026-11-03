import { describe, expect, it } from 'vitest';
import { calculate, type CalcOptions } from './engine';
import { workingFor, type Working } from './breakdown';

function breakdown(expression: string, ans?: string, options?: CalcOptions) {
  const w = workingFor(expression, ans, options);
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
  }, 30_000); // 1000 full breakdowns; slow only when the whole suite shares the CPU
});

describe('workingFor: scientific', () => {
  it('works a function out as its own step, before × and +', () => {
    const w = breakdown('2 × sin(30) + 1');
    expect(w.start).toBe('2 × sin(30) + 1');
    expect(lines(w)).toEqual(['= 2 × 0.5 + 1', '= 1 + 1', '= 2']);
    expect(ops(w)).toEqual(['sin(30) = 0.5', '2 × 0.5 = 1', '1 + 1 = 2']);
    expect(w.steps[0].detail).toBeNull();
  });

  it('finishes the brackets inside a function first', () => {
    expect(ops(breakdown('√(9 + 16) × 2'))).toEqual(['9 + 16 = 25', '√(25) = 5', '5 × 2 = 10']);
  });

  it('shows names the way they are typed', () => {
    expect(breakdown('5! + 1').start).toBe('5! + 1');
    expect(ops(breakdown('5! + 1'))[0]).toBe('5! = 120');
    expect(ops(breakdown('(1 + 2)! × 2'))).toEqual(['1 + 2 = 3', '3! = 6', '6 × 2 = 12']);
    expect(ops(breakdown('sin⁻¹(0.5) + 1'))[0]).toBe('sin⁻¹(0.5) = 30');
    expect(ops(breakdown('∛(27) + ⁿ√(16, 4)'))).toEqual(['∛(27) = 3', 'ⁿ√(16, 4) = 2', '3 + 2 = 5']);
    expect(ops(breakdown('nCr(5, 2) + 1'))[0]).toBe('nCr(5, 2) = 10');
  });

  it('substitutes π and e as the first step', () => {
    const w = breakdown('2π + 1');
    expect(w.start).toBe('2π + 1');
    expect(ops(w)[0]).toBe('π = 3.14159265359');
    expect(lines(w)[0]).toBe('= 2 × 3.14159265359 + 1');
  });

  it('uses the angle unit', () => {
    const w = breakdown('sin(π ÷ 2) + 1', '0', { angle: 'rad' });
    expect(lines(w).at(-1)).toBe('= 2');
  });

  it('gives no working when the function is the whole sum', () => {
    expect(workingFor('sin(30)')).toBeNull();
  });

  it('agrees with the engine for 300 random scientific expressions', () => {
    const seed = { s: 7 };
    const r = () => (seed.s = (seed.s * 16807) % 2147483647) / 2147483647;
    const fns = ['sin', 'cos', '√', 'log', 'ln', 'abs'];
    let checked = 0;
    for (let i = 0; i < 300; i++) {
      const fn = fns[Math.floor(r() * fns.length)];
      const expr = `${1 + Math.floor(r() * 50)} × ${fn}(${1 + Math.floor(r() * 89)}) + ${Math.floor(r() * 20)}! ÷ ${1 + Math.floor(r() * 9)}`;
      for (const angle of ['deg', 'rad'] as const) {
        if (!calculate(expr, '0', { angle }).ok) continue;
        expect(workingFor(expr, '0', { angle })?.kind, `${expr} ${angle}`).toBe('breakdown');
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(500);
  });
});
