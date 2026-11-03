import { describe, expect, it } from 'vitest';
import { formatNumber } from './format';
import { solve } from './solver';
import type { CalcOptions } from './engine';

const roots = (equation: string, options: CalcOptions = {}) => {
  const r = solve(equation, '0', options);
  return r.ok ? r.roots.map(formatNumber) : r.error;
};

describe('solve', () => {
  it.each([
    ['2x + 3 = 11', ['4']],
    ['x = 7', ['7']],
    ['3 = x − 2', ['5']],
    ['x² = 4', ['-2', '2']],
    ['x^3 = 27', ['3']],
    ['x² − 5x + 6 = 0', ['2', '3']],
    ['1/x = 4', ['0.25']],
    ['2^x = 1024', ['10']],
    ['√(x) = 3', ['9']],
    ['10^(x) = 0.001', ['-3']],
    ['ln(x) = 1', ['2.71828182846']],
    ['(x − 3)² = 0', ['3']],
    ['x/3 = 0.1', ['0.3']],
  ])('%s → %j', (equation, expected) => {
    expect(roots(equation)).toEqual(expected);
  });

  it('solves trig in degrees and radians', () => {
    expect(roots('sin(x) = 0.5')[0]).toBe('30');
    expect(roots('cos(x) = 0', { angle: 'rad' })[0]).toBe('1.57079632679');
  });

  it('uses the other letters\' values and solves for the empty one', () => {
    expect(roots('ax + b = 0', { vars: { a: '2', b: '-8' } })).toEqual(['4']);
    const r = solve('v = u + at', '0', { vars: { v: '20', u: '5', t: '3' } });
    expect(r.ok && r.unknown).toBe('a');
    expect(r.ok && r.roots.map(formatNumber)).toEqual(['5']);
  });

  it('never reports a pole as a root', () => {
    expect(roots('1/x = 0')).toBe('no-solution');
    expect((roots('tan(x) = 1') as string[]).every((x: string) => x !== '90')).toBe(true);
  });

  it.each([
    ['x² = -1', 'no-solution'],
    ['x + y = 3', 'solve-one-unknown'],
    ['2 + 2 = 4', 'solve-one-unknown'],
    ['x = = 3', 'invalid'],
    ['= 3', 'invalid'],
    ['foo(x) = 3', 'invalid'],
  ])('%s → %s', (equation, expected) => {
    expect(roots(equation)).toBe(expected);
  });

  it('flags when there are more solutions than it lists', () => {
    const r = solve('sin(x) = 0', '0', { angle: 'rad' });
    expect(r.ok && r.more).toBe(true);
    expect(r.ok && r.roots.length).toBe(4);
    expect(r.ok && formatNumber(r.roots[0])).toBe('0');
  });

  it('is fast enough to run on "="', () => {
    const t = performance.now();
    solve('sin(x) + x² = 3', '0', {});
    expect(performance.now() - t).toBeLessThan(1500);
  });
});
