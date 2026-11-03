import { describe, expect, it } from 'vitest';
import { calculate, ERROR_MESSAGES } from './engine';

const display = (expression: string, ans?: string) => {
  const result = calculate(expression, ans);
  if (!result.ok) throw new Error(`${expression} -> ${result.error}`);
  return result.display;
};
const error = (expression: string) => {
  const result = calculate(expression);
  return result.ok ? `ok:${result.display}` : result.error;
};

describe('calculate: exact arithmetic', () => {
  it.each([
    ['0.1 + 0.2', '0.3'],
    ['1/3*3', '1'],
    ['550 / 600', '0.916666666667'],
    ['0.9166666666666 * 100', '91.6666666667'],
    ['11720 - 9', '11,711'],
    ['2(3)', '6'],
    ['2^10', '1,024'],
    ['(2+3)*4', '20'],
    ['-5 - -3', '-2'],
    ['−5 + 1', '-4'],
    ['6÷3×2', '4'],
    ['1e30 * 1e30', '1e+60'],
    ['0.000000000123', '1.23e-10'],
    ['99999999999999', '99,999,999,999,999'],
    ['  7  ', '7'],
  ])('%s = %s', (expression, expected) => {
    expect(display(expression)).toBe(expected);
  });
});

describe('calculate: phone-style percent', () => {
  it.each([
    ['50+10%', '55'],
    ['50-10%', '45'],
    ['200×15%', '30'],
    ['10%', '0.1'],
    ['7%3', '0.21'],
    ['7% 3', '0.21'],
    ['50%(4)', '2'],
  ])('%s = %s', (expression, expected) => {
    expect(display(expression)).toBe(expected);
  });
});

describe('calculate: Ans', () => {
  it('defaults to 0', () => {
    expect(display('Ans + 1')).toBe('1');
  });

  it('accepts lowercase ans', () => {
    expect(display('ans*2', '21')).toBe('42');
  });

  it('chains on the exact value, not the rounded display', () => {
    const third = calculate('1/3');
    if (!third.ok) throw new Error('1/3 failed');
    expect(third.display).toBe('0.333333333333');
    expect(display('Ans*3', third.exact)).toBe('1');
  });
});

describe('calculate: errors never throw', () => {
  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['1/0', 'divide-by-zero'],
    ['0/0', 'divide-by-zero'],
    ['5/(2-2)', 'divide-by-zero'],
    ['1 / (Ans - Ans)', 'divide-by-zero'],
    ['%', 'invalid'],
    ['5+%', 'invalid'],
    ['5+', 'invalid'],
    ['((2', 'invalid'],
    ['foo(1)', 'invalid'],
    ['foo+1', 'missing-value'],
    ['sinh(1)', 'invalid'],
    ['x + 1', 'missing-value'],
    ['7 mod 3', 'invalid'],
    ['f(x) = x', 'invalid'],
    ['[1, 2]', 'invalid'],
    ['a = 1; 2', 'invalid'],
    ['"text"', 'invalid'],
    ['x = 5', 'invalid'],
    ['2 == 2', 'invalid'],
    ['1'.repeat(1001), 'invalid'],
    ['10^(10^20)', 'too-large'],
  ])('%j -> %s', (expression, expected) => {
    expect(error(expression)).toBe(expected);
  });

  it('has a message for every error', () => {
    for (const code of ['empty', 'divide-by-zero', 'invalid', 'too-large', 'math-error', 'missing-value', 'solve-one-unknown', 'no-solution'] as const) {
      expect(ERROR_MESSAGES[code]).toBeTypeOf('string');
    }
    expect(ERROR_MESSAGES['divide-by-zero']).toBe("Can't divide by 0");
    expect(ERROR_MESSAGES.invalid).toBe('Invalid format');
  });
});

it('handles a power with hundreds of millions of digits quickly', () => {
  const start = Date.now();
  const outcome = calculate('9^9^9');
  expect(outcome.ok && outcome.display).toMatch(/^4\.28124773176e\+369693099$/);
  expect(Date.now() - start).toBeLessThan(2000);
});
