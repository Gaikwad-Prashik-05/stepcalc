export interface KeypadState {
  text: string;
  /** Selection range in the text; start === end is a plain caret. */
  start: number;
  end: number;
  /** True right after "=", until the next key. */
  justEvaluated: boolean;
}

export type Key =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.'
  | '+' | '−' | '×' | '÷' | '%' | 'Ans' | 'AC' | '⌫';

const OPERATORS = new Set(['+', '−', '×', '÷', '%']);

const caret = (text: string, pos: number): KeypadState => ({ text, start: pos, end: pos, justEvaluated: false });

/** Pure keypad editing; "=" is not a key here, the UI calls the engine for it. */
export function applyKey(state: KeypadState, key: Key): KeypadState {
  if (key === 'AC') return caret('', 0);

  if (state.justEvaluated) {
    // Phone behaviour: an operator continues from the answer, anything else starts over.
    if (OPERATORS.has(key)) return caret(`Ans${key}`, key.length + 3);
    if (key === '⌫') return applyKey(caret(state.text, state.text.length), key);
    return caret(key, key.length);
  }

  const { text, start, end } = state;
  if (key === '⌫') {
    if (start !== end) return caret(text.slice(0, start) + text.slice(end), start);
    if (start === 0) return caret(text, 0);
    return caret(text.slice(0, start - 1) + text.slice(end), start - 1);
  }
  return caret(text.slice(0, start) + key + text.slice(end), start + key.length);
}
