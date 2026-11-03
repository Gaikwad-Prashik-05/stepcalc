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
  | '+' | '−' | '×' | '÷' | '%' | 'Ans' | 'AC' | '⌫'
  | ScientificKey;

/** Keys that insert `text()` with the caret between the brackets. */
const FUNCTIONS = {
  sin: 'sin', cos: 'cos', tan: 'tan', 'sin⁻¹': 'sin⁻¹', 'cos⁻¹': 'cos⁻¹', 'tan⁻¹': 'tan⁻¹',
  log: 'log', ln: 'ln', '√': '√', '∛': '∛', 'ⁿ√': 'ⁿ√', abs: 'abs', nCr: 'nCr', nPr: 'nPr',
  '10ˣ': '10^', 'eˣ': 'e^',
} as const;
/** Keys that insert a symbol; postfix ones continue from Ans right after "=". */
const SYMBOLS = { 'x²': '²', 'xʸ': '^', 'x!': '!', π: 'π', e: 'ℯ', '(': '(', ')': ')', ',': ',', x: 'x', eq: '=' } as const;
const POSTFIX = new Set(['x²', 'xʸ', 'x!']);

export type ScientificKey = keyof typeof FUNCTIONS | keyof typeof SYMBOLS | '±';

const OPERATORS = new Set(['+', '−', '×', '÷', '%']);
const NUMBER_CHAR = /[\d.]/;

const caret = (text: string, pos: number): KeypadState => ({ text, start: pos, end: pos, justEvaluated: false });

/** Pure keypad editing; "=" is not a key here, the UI calls the engine for it. */
export function applyKey(state: KeypadState, key: Key): KeypadState {
  if (key === 'AC') return caret('', 0);

  if (state.justEvaluated) {
    // Phone behaviour: an operator continues from the answer, anything else starts over.
    if (OPERATORS.has(key)) return caret(`Ans${key}`, key.length + 3);
    if (POSTFIX.has(key)) return applyKey(caret('Ans', 3), key);
    if (key === '±') return caret('(−Ans)', 6);
    if (key === '⌫') return applyKey(caret(state.text, state.text.length), key);
    return applyKey(caret('', 0), key);
  }

  const { text, start, end } = state;
  if (key === '⌫') {
    if (start !== end) return caret(text.slice(0, start) + text.slice(end), start);
    if (start === 0) return caret(text, 0);
    return caret(text.slice(0, start - 1) + text.slice(end), start - 1);
  }
  if (key === '±') return toggleSign(text, start, end);
  if (key === ')' && start === end && text[start] === ')') return caret(text, start + 1);

  const insert = key in FUNCTIONS ? `${FUNCTIONS[key as keyof typeof FUNCTIONS]}()` : key in SYMBOLS ? SYMBOLS[key as keyof typeof SYMBOLS] : key;
  const at = start + insert.length - (key in FUNCTIONS ? 1 : 0);
  return caret(text.slice(0, start) + insert + text.slice(end), at);
}

/** ± on the number at the caret: 12 → (−12) → 12; with no number there it starts one with "(−". */
function toggleSign(text: string, start: number, end: number): KeypadState {
  const wrapped = /\(−([\d.]+)\)$/.exec(text.slice(0, start));
  if (wrapped) {
    const from = start - wrapped[0].length;
    return caret(text.slice(0, from) + wrapped[1] + text.slice(start), from + wrapped[1].length);
  }
  let from = start;
  let to = end;
  while (from > 0 && NUMBER_CHAR.test(text[from - 1])) from--;
  while (to < text.length && NUMBER_CHAR.test(text[to])) to++;
  if (from === to) return caret(text.slice(0, start) + '(−' + text.slice(end), start + 2);
  if (text.slice(from - 2, from) === '(−' && text[to] === ')') {
    return caret(text.slice(0, from - 2) + text.slice(from, to) + text.slice(to + 1), to - 2);
  }
  const number = text.slice(from, to);
  return caret(`${text.slice(0, from)}(−${number})${text.slice(to)}`, to + 3);
}
