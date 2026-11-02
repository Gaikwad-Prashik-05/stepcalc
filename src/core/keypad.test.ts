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
