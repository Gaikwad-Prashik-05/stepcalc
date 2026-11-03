import { describe, expect, it } from 'vitest';
import { calculate, lettersIn, type CalcOptions } from './engine';

const run = (expression: string, options: CalcOptions = {}) => {
  const r = calculate(expression, '0', options);
  return r.ok ? r.display : r.error;
};

// Reference values as shown on a Casio fx-991 style calculator (10-12 significant digits).
describe('scientific: degrees', () => {
  it.each([
    ['sin(30)', '0.5'], ['cos(60)', '0.5'], ['tan(45)', '1'],
    ['sin(180)', '0'], ['cos(90)', '0'], ['sin(360)', '0'], ['cos(270)', '0'], ['tan(180)', '0'],
    ['tan(90)', 'math-error'], ['tan(-270)', 'math-error'],
    ['sin(45)', '0.707106781187'], ['cos(30)', '0.866025403784'], ['tan(60)', '1.73205080757'],
    ['sin⁻¹(0.5)', '30'], ['cos⁻¹(0.5)', '60'], ['tan⁻¹(1)', '45'], ['sin⁻¹(1)', '90'], ['cos⁻¹(-1)', '180'],
    ['sin⁻¹(2)', 'math-error'],
    ['sin(30)^2 + cos(30)^2', '1'],
  ])('%s = %s', (e, expected) => {
    expect(run(e, { angle: 'deg' })).toBe(expected);
  });
});

describe('scientific: radians', () => {
  it.each([
    ['sin(π/6)', '0.5'], ['cos(π)', '-1'], ['sin(π)', '0'], ['tan⁻¹(1)', '0.785398163397'],
    ['sin(1)', '0.841470984808'], ['cos(2π)', '1'],
  ])('%s = %s', (e, expected) => {
    expect(run(e, { angle: 'rad' })).toBe(expected);
  });
});

describe('scientific: logs, roots, powers', () => {
  it.each([
    ['log(1000)', '3'], ['log(2)', '0.301029995664'], ['ln(e)', '1'], ['ln(1)', '0'], ['e^2', '7.38905609893'],
    ['ln(0)', 'math-error'], ['log(-1)', 'math-error'],
    ['√(16)', '4'], ['√(2)', '1.41421356237'], ['√(-1)', 'math-error'], ['√16', '4'],
    ['∛(27)', '3'], ['∛(-8)', '-2'], ['ⁿ√(8, 3)', '2'], ['ⁿ√(-8, 3)', '-2'], ['ⁿ√(16, 4)', '2'], ['ⁿ√(-16, 4)', 'math-error'],
    ['3²', '9'], ['2^0.5', '1.41421356237'], ['1.5×10^3', '1,500'], ['abs(-3)', '3'],
    ['π', '3.14159265359'], ['e', '2.71828182846'], ['2π', '6.28318530718'],
  ])('%s = %s', (e, expected) => {
    expect(run(e)).toBe(expected);
  });
});

describe('scientific: factorial, nCr, nPr, mod', () => {
  it.each([
    ['5!', '120'], ['0!', '1'], ['(2+3)!', '120'], ['3!!', '720'], ['2.5!', 'math-error'], ['(-1)!', 'math-error'],
    ['20!', '2.43290200818e+18'], ['100!', '9.33262154439e+157'],
    ['nCr(5, 2)', '10'], ['nPr(5, 2)', '20'], ['nCr(52, 5)', '2,598,960'], ['nCr(2, 5)', 'math-error'],
    ['mod(7, 3)', '1'], ['mod(-7, 3)', '2'], ['mod(7.5, 2)', '1.5'], ['mod(7, 0)', 'divide-by-zero'],
  ])('%s = %s', (e, expected) => {
    expect(run(e)).toBe(expected);
  });
});

describe('variables', () => {
  it('uses the given values', () => {
    expect(run('2x + y', { vars: { x: '3', y: '0.5' } })).toBe('6.5');
  });

  it('needs every value', () => {
    expect(run('2x + y', { vars: { x: '3' } })).toBe('missing-value');
  });

  it('finds the letters, but not e or function names', () => {
    expect(lettersIn('2x − log(xⁿ) + sin(y) + e')).toEqual(['n', 'x', 'y']);
    expect(lettersIn('2x + 3 = 11')).toEqual(['x']);
    expect(lettersIn('1 +')).toEqual([]);
  });

  it('still rejects unknown function names', () => {
    expect(run('foo(1)')).toBe('invalid');
    expect(run('sinh(1)')).toBe('invalid');
  });

  it('multiplies letters written together', () => {
    expect(lettersIn('2xy + at')).toEqual(['a', 't', 'x', 'y']);
    expect(run('2xy', { vars: { x: '3', y: '4' } })).toBe('24');
    expect(run('x(2 + 1)', { vars: { x: '2' } })).toBe('6');
    expect(run('ab(1 + 1)', { vars: { a: '2', b: '5' } })).toBe('20');
    expect(run('ex', { vars: { x: '1' } })).toBe('2.71828182846');
    expect(run('sin(x)cos(x)', { vars: { x: '45' } })).toBe('0.5');
  });
});

describe('scientific: what the keypad types', () => {
  it.each([
    ['10^(3)', '1,000'], ['e^(1)', '2.71828182846'], ['5+(−12)', '−7'], ['(−2)²', '4'],
    ['2sin(30)', '1'], ['2π', '6.28318530718'], ['2e', '5.43656365692'], ['3e', '8.15484548538'],
    ['nCr(5,2)', '10'], ['ⁿ√(27,3)', '3'], ['abs(−3)', '3'], ['sin()', 'invalid'], ['√()', 'invalid'],
  ])('%s = %s', (e, expected) => {
    expect(run(e).replace('-', '−')).toBe(expected);
  });

  it('Ans works with postfix keys', () => {
    const r = calculate('Ans²', '3');
    expect(r.ok && r.display).toBe('9');
  });
});

describe('scientific: π and the e key next to digits', () => {
  it.each([
    ['2ℯ3', '16.3096909708'], ['ℯ2', '5.43656365692'], ['2ℯ', '5.43656365692'], ['ℯ^(2)', '7.38905609893'],
    ['π2', '6.28318530718'], ['2π3', '18.8495559215'], ['ππ', '9.86960440109'], ['ℯπ', '8.53973422267'],
    ['2e3', '2,000'],
  ])('%s = %s', (e, expected) => {
    expect(run(e)).toBe(expected);
  });

  it('ℯ is the constant, not a letter to fill in', () => {
    expect(lettersIn('2ℯ + x')).toEqual(['x']);
  });
});

describe('scientific: ℯ never turns into an exponent', () => {
  it.each([['2ℯ+3', '8.43656365692'], ['2ℯ−1', '4.43656365692'], ['1.5ℯ', '4.07742274269']])('%s = %s', (e, expected) => {
    expect(run(e)).toBe(expected);
  });
});
