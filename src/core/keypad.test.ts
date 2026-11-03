import { describe, expect, it } from 'vitest';
import { applyKey, type KeypadState } from './keypad';

const at = (text: string, caret = text.length, justEvaluated = false): KeypadState => ({
  text, start: caret, end: caret, justEvaluated,
});

describe('applyKey', () => {
  it('inserts at the caret', () => {
    expect(applyKey(at('12', 1), '5')).toEqual(at('152', 2));
  });

  it('replaces a selection', () => {
    expect(applyKey({ text: '1234', start: 1, end: 3, justEvaluated: false }, '+')).toEqual(at('1+4', 2));
  });

  it('backspace deletes the char before the caret, or the selection', () => {
    expect(applyKey(at('123', 2), '⌫')).toEqual(at('13', 1));
    expect(applyKey(at('123', 0), '⌫')).toEqual(at('123', 0));
    expect(applyKey({ text: '1234', start: 1, end: 3, justEvaluated: false }, '⌫')).toEqual(at('14', 1));
  });

  it('AC clears everything', () => {
    expect(applyKey(at('12+3'), 'AC')).toEqual(at(''));
  });

  it('Ans key inserts Ans', () => {
    expect(applyKey(at('2×'), 'Ans')).toEqual(at('2×Ans'));
  });

  it('after =, an operator continues from Ans', () => {
    for (const op of ['+', '−', '×', '÷', '%'] as const) {
      expect(applyKey(at('12+3', 4, true), op)).toEqual(at(`Ans${op}`));
    }
  });

  it('after =, a digit, dot or Ans starts fresh', () => {
    expect(applyKey(at('12+3', 4, true), '7')).toEqual(at('7'));
    expect(applyKey(at('12+3', 4, true), '.')).toEqual(at('.'));
    expect(applyKey(at('12+3', 4, true), 'Ans')).toEqual(at('Ans'));
  });

  it('after =, backspace edits the old expression', () => {
    expect(applyKey(at('12+3', 4, true), '⌫')).toEqual(at('12+'));
  });
});

describe('applyKey: scientific keys', () => {
  it('function keys insert name() with the caret inside', () => {
    expect(applyKey(at('2×'), 'sin')).toEqual(at('2×sin()', 6));
    expect(applyKey(at(''), 'sin⁻¹')).toEqual(at('sin⁻¹()', 6));
    expect(applyKey(at(''), '√')).toEqual(at('√()', 2));
    expect(applyKey(at(''), 'nCr')).toEqual(at('nCr()', 4));
    expect(applyKey(at(''), '10ˣ')).toEqual(at('10^()', 4));
    expect(applyKey(at(''), 'eˣ')).toEqual(at('e^()', 3));
  });

  it('postfix keys insert their symbol', () => {
    expect(applyKey(at('3'), 'x²')).toEqual(at('3²'));
    expect(applyKey(at('2'), 'xʸ')).toEqual(at('2^'));
    expect(applyKey(at('5'), 'x!')).toEqual(at('5!'));
    expect(applyKey(at('2'), 'π')).toEqual(at('2π'));
    expect(applyKey(at('nCr(5'), ',')).toEqual(at('nCr(5,'));
  });

  it('after =, postfix keys continue from Ans and functions start fresh', () => {
    expect(applyKey(at('2+1', 3, true), 'x²')).toEqual(at('Ans²'));
    expect(applyKey(at('2+1', 3, true), 'x!')).toEqual(at('Ans!'));
    expect(applyKey(at('2+1', 3, true), 'xʸ')).toEqual(at('Ans^'));
    expect(applyKey(at('2+1', 3, true), 'sin')).toEqual(at('sin()', 4));
  });

  it(') steps over a closing bracket that is already there', () => {
    expect(applyKey(at('sin(30)', 6), ')')).toEqual(at('sin(30)', 7));
    expect(applyKey(at('(2+3', 4), ')')).toEqual(at('(2+3)'));
  });

  it('± wraps the number at the caret in (−…) and unwraps it again', () => {
    expect(applyKey(at('5+12'), '±')).toEqual(at('5+(−12)'));
    expect(applyKey(at('5+(−12)', 6), '±')).toEqual(at('5+12'));
    expect(applyKey(at('5+(−12)'), '±')).toEqual(at('5+12'));
    expect(applyKey(at('12', 1), '±')).toEqual(at('(−12)'));
    expect(applyKey(at('5×'), '±')).toEqual(at('5×(−'));
    expect(applyKey(at('2.5'), '±')).toEqual(at('(−2.5)'));
  });

  it('after =, ± negates the answer', () => {
    expect(applyKey(at('2+1', 3, true), '±')).toEqual(at('(−Ans)'));
  });
});

describe('applyKey: equations', () => {
  it('x and the equation sign insert as typed', () => {
    expect(applyKey(at('2'), 'x')).toEqual(at('2x'));
    expect(applyKey(at('2x+3'), 'eq')).toEqual(at('2x+3='));
  });

  it('after =, x starts a new expression', () => {
    expect(applyKey(at('2+1', 3, true), 'x')).toEqual(at('x'));
  });
});
