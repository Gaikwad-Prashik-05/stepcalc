import { describe, expect, it } from 'vitest';
import { workingFor } from './breakdown';
import { calculate, lettersIn } from './engine';
import { integralWorking } from './integral-steps';

const display = (e: string, options = {}) => {
  const r = calculate(e, '0', options);
  return r.ok ? r.display : r.error;
};

describe('∫(f, a, b)', () => {
  it.each([
    ['∫(x^2,0,3)', '9'],
    ['∫(3x²+2x,0,2)', '12'],
    ['∫(1/x,1,ℯ)', '1'],
    ['∫(√x,0,4)', '5.33333333333'],
    ['∫(x,3,0)', '-4.5'],
    ['∫(1/√x,0,4)', '4'],
    ['∫(5,2,2)', '0'],
    ['2∫(x,0,1)+1', '2'],
    ['∫(ℯ^(−x²),0,1)', '0.746824132812'],
  ])('%s = %s', (e, expected) => {
    expect(display(e)).toBe(expected);
  });

  it('follows the angle unit, and cancels to exactly 0 over a full turn', () => {
    expect(display('∫(sin(x),0,π)', { angle: 'rad' })).toBe('2');
    expect(display('∫(sin(x),0,2π)', { angle: 'rad' })).toBe('0');
    expect(display('∫(sin(x),0,180)', { angle: 'deg' })).toBe('114.591559026');
  });

  it.each([
    ['∫(1/x,0,1)', 'math-error'],
    ['∫(1/x,−1,1)', 'math-error'],
    ['∫(abs(x),−1,2)', 'math-error'], // a corner inside the range: known limit
    ['∫(ln(x),−1,1)', 'math-error'],
    ['∫(x^2,0)', 'invalid'],
    ['∫(x^2)', 'invalid'],
    ['∫(∫(x,0,x),0,1)', 'math-error'],
  ])('%s → %s', (e, expected) => {
    expect(display(e)).toBe(expected);
  });

  it('x inside the integral needs no value; other letters and an outside x do', () => {
    expect(lettersIn('∫(x^2,0,3)')).toEqual([]);
    expect(lettersIn('∫(a×x,0,b)')).toEqual(['a', 'b']);
    expect(lettersIn('x+∫(x,0,1)')).toEqual(['x']);
    expect(display('∫(a×x,0,b)', { vars: { a: '2', b: '3' } })).toBe('9');
    expect(display('x+∫(x,0,1)', { vars: { x: '10' } })).toBe('10.5');
  });
});

describe('integralWorking', () => {
  const lines = (e: string, options = {}) => {
    const w = integralWorking(e, '0', options);
    if (w?.kind !== 'breakdown') throw new Error(`no working for ${e}`);
    return [w.start, ...w.steps.map((s) => s.line)];
  };

  it('power rule term by term, then F(b) − F(a)', () => {
    expect(lines('∫(3x²+2x,0,2)')).toEqual([
      '∫ (3x² + 2x) dx, from 0 to 2',
      '∫ 3x² dx = x³',
      '∫ 2x dx = x²',
      'F(x) = x³ + x²',
      'F(2) = 12',
      'F(0) = 0',
      '= 12',
    ]);
  });

  it('fractions, constants, roots and negative terms', () => {
    expect(lines('∫(x^2−5,0,3)').slice(1, 4)).toEqual(['∫ x² dx = x³/3', '∫ −5 dx = −5x', 'F(x) = x³/3 − 5x']);
    expect(lines('∫(√x,0,4)').slice(1, 3)).toEqual(['∫ x^(1/2) dx = 2x^(3/2)/3', 'F(x) = 2x^(3/2)/3']);
    expect(lines('∫(1/x,1,ℯ)').slice(1, 3)).toEqual(['∫ x⁻¹ dx = ln|x|', 'F(x) = ln|x|']);
    expect(lines('∫(6/x^3,1,2)')[1]).toBe('∫ 6x⁻³ dx = −3x⁻²');
  });

  it('shows simple fractions as fractions', () => {
    const w = integralWorking('∫(x^2,0,2)');
    if (w?.kind !== 'breakdown') throw new Error('no working');
    expect(w.steps.map((s) => s.line)).toEqual(['∫ x² dx = x³/3', 'F(x) = x³/3', 'F(2) = 8/3', 'F(0) = 0', '= 2.66666666667']);
    expect(w.steps.at(-1)!.op).toBe('F(2) − F(0) = 8/3 − 0');
  });

  it('sin, cos and eˣ in radians', () => {
    expect(lines('∫(2sin(x)+ℯ^x,0,1)', { angle: 'rad' }).slice(1, 4)).toEqual(['∫ 2 sin x dx = −2 cos x', '∫ eˣ dx = eˣ', 'F(x) = −2 cos x + eˣ']);
    expect(lines('∫(sin(x),0,180)', { angle: 'deg' })).toHaveLength(2); // numerical note only
  });

  it('says so when it can only add the area up numerically', () => {
    const w = lines('∫(ℯ^(−x²),0,1)');
    expect(w).toEqual(['∫ ℯ^(−x²) dx, from 0 to 1', '≈ 0.746824132812']);
  });

  it('is only for a single integral', () => {
    expect(integralWorking('2+3')).toBeNull();
    expect(integralWorking('1+∫(x,0,1)')).toBeNull();
    expect(workingFor('1+∫(x,0,1)')).toBeNull();
  });
});

describe('working for remainder and powers', () => {
  const text = (e: string) => {
    const w = workingFor(e);
    if (w?.kind !== 'grid') throw new Error(`no grid for ${e}`);
    return w.grid.lines.map((l) => l.text);
  };

  it('remainder: divide, round down, multiply back, subtract', () => {
    expect(text('-10%3')).toEqual(['−10 ÷ 3 = −3.33333333333', 'whole part, rounded down = −4', '−4 × 3 = −12', '−10 − (−12) = 2']);
    expect(text('17%5')).toEqual(['17 ÷ 5 = 3.4', 'whole part, rounded down = 3', '3 × 5 = 15', '17 − 15 = 2']);
  });

  it('remainder inside a longer sum is one step that opens', () => {
    const w = workingFor('2+7%3×2');
    if (w?.kind !== 'breakdown') throw new Error('expected a breakdown');
    expect(w.start).toBe('2 + 7 mod 3 × 2');
    expect(w.steps.map((s) => s.op)).toEqual(['7 mod 3 = 1', '1 × 2 = 2', '2 + 2 = 4']);
    expect(w.steps[0].detail).not.toBeNull();
  });

  it('powers: square root, repeated multiplication, one over', () => {
    expect(text('4**0.5')).toEqual(['4 ^ 0.5 = √4', '= 2']);
    expect(text('2^5')).toEqual(['2 ^ 5 = 2 × 2 × 2 × 2 × 2', '= 32']);
    expect(text('2^-3')).toEqual(['2 ^ (−3) = 1 ÷ (2 × 2 × 2)', '= 1 ÷ 8', '= 0.125']);
    expect(workingFor('2^0.3')).toBeNull();
  });
});
