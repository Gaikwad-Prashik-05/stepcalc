import { calculate, ERROR_MESSAGES } from '../core/engine';
import { formatEng, toFraction } from '../core/format';
import type { AngleUnit } from '../core/functions';
import { addEntry, clearHistory, groupByDay, type HistoryEntry } from '../core/history';
import { applyKey, type Key } from '../core/keypad';
import { workingFor } from '../core/breakdown';
import { loadHistory, saveHistory } from './history-store';
import { ANGLE_KEY, loadPref, MODE_KEY, savePref } from './prefs';
import { createStepsView } from './steps-view';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const KEYS: (Key | '=')[] = [
  'AC', '⌫', '%', '÷',
  '7', '8', '9', '×',
  '4', '5', '6', '−',
  '1', '2', '3', '+',
  'Ans', '0', '.', '=',
];
// Scientific: Casio-style 5-column pad (4 rows), so the function block fits above it on a phone.
const SCIENTIFIC_PAD: (Key | '=')[] = [
  '7', '8', '9', '⌫', 'AC',
  '4', '5', '6', '×', '÷',
  '1', '2', '3', '+', '−',
  '0', '.', '%', 'Ans', '=',
];
type Toggle = 'DEG' | 'ENG' | 'S⇔D';
const FUNCTION_KEYS: (Key | Toggle)[] = [
  'DEG', 'ENG', 'S⇔D', 'π', 'e', '±',
  'sin', 'cos', 'tan', 'log', 'ln', '√',
  'sin⁻¹', 'cos⁻¹', 'tan⁻¹', '10ˣ', 'eˣ', '∛',
  'x²', 'xʸ', 'ⁿ√', 'x!', 'nCr', 'nPr',
  '(', ')', ',', 'abs',
];
const TOGGLES = new Set<string>(['DEG', 'ENG', 'S⇔D']);
const KEY_LABELS: Partial<Record<Key | '=' | Toggle, string>> = {
  '⌫': 'Backspace', AC: 'All clear', '−': 'Minus', '×': 'Times', '÷': 'Divide by',
  ENG: 'Engineering notation', 'S⇔D': 'Show as fraction', π: 'Pi', e: 'e', '±': 'Change sign',
  'sin⁻¹': 'Inverse sine', 'cos⁻¹': 'Inverse cosine', 'tan⁻¹': 'Inverse tangent', log: 'Log base 10', ln: 'Natural log',
  '√': 'Square root', '∛': 'Cube root', 'ⁿ√': 'Nth root', '10ˣ': 'Ten to the power', 'eˣ': 'e to the power',
  'x²': 'Square', 'xʸ': 'Power', 'x!': 'Factorial', ',': 'Comma', abs: 'Absolute value',
};
const MODES = ['Basic', 'Scientific', 'Conversion', 'Draw'] as const;
const READY_MODES = ['Basic', 'Scientific'] as const;
type Mode = (typeof READY_MODES)[number];
const TRIG = /sin|cos|tan/;

function buildKeys(keys: readonly (Key | '=' | Toggle)[], className: string): HTMLDivElement {
  const keypad = el('div', className);
  for (const key of keys) {
    const button = el('button', 'key', key);
    button.type = key === '=' ? 'submit' : 'button';
    if (TOGGLES.has(key)) button.dataset.toggle = key;
    else button.dataset.key = key;
    if (KEY_LABELS[key]) button.setAttribute('aria-label', KEY_LABELS[key]);
    if (key === '=') button.classList.add('key-equals');
    else if (['÷', '×', '−', '+', '%'].includes(key)) button.classList.add('key-op');
    else if (key === 'AC' || key === '⌫' || TOGGLES.has(key)) button.classList.add('key-fn');
    keypad.append(button);
  }
  return keypad;
}

export function renderApp(root: HTMLElement): void {
  let ans = '0';
  let justEvaluated = false;
  let history: HistoryEntry[] = loadHistory();
  let mode: Mode = loadPref(MODE_KEY, READY_MODES, 'Basic');
  let angle: AngleUnit = loadPref(ANGLE_KEY, ['deg', 'rad'] as const, 'deg');
  // ENG and S⇔D change how the current answer is shown, like on a Casio; the next "=" resets them.
  let shown: { exact: string; display: string } | null = null;
  let view: 'normal' | 'ENG' | 'S⇔D' = 'normal';

  const steps = createStepsView();
  const header = el('header', 'app-header');
  const title = el('div');
  title.append(el('h1', undefined, 'StepCalc'), el('p', 'tagline', 'Show my work'));
  const modeSelect = el('select', 'mode-select');
  modeSelect.setAttribute('aria-label', 'Mode');
  for (const name of MODES) {
    const ready = (READY_MODES as readonly string[]).includes(name);
    const option = el('option', undefined, ready ? name : `${name} (soon)`);
    option.value = name;
    option.disabled = !ready;
    modeSelect.append(option);
  }
  const controls = el('div', 'header-controls');
  controls.append(steps.switchElement, modeSelect);
  header.append(title, controls);

  const form = el('form', 'calc');
  const label = el('label', 'calc-label visually-hidden', 'Expression');
  label.htmlFor = 'expression';
  const input = el('input', 'calc-input');
  Object.assign(input, { id: 'expression', type: 'text', autocomplete: 'off', spellcheck: false, placeholder: '0' });
  input.setAttribute('enterkeyhint', 'done');
  // The on-screen keypad replaces the phone keyboard; laptop typing still works.
  input.setAttribute('inputmode', 'none');
  const result = el('output', 'calc-result');
  result.setAttribute('for', 'expression');
  result.setAttribute('role', 'status');

  const keys = el('div', 'keys');
  const basicPad = buildKeys(KEYS, 'keypad');
  const functionKeys = buildKeys(FUNCTION_KEYS, 'function-keys');
  const scientificPad = buildKeys(SCIENTIFIC_PAD, 'keypad keypad-scientific');
  keys.append(basicPad, functionKeys, scientificPad);
  form.append(label, input, result, keys);
  const toggle = (name: Toggle) => functionKeys.querySelector<HTMLButtonElement>(`[data-toggle="${name}"]`)!;

  function renderResult(): void {
    if (!shown) return;
    const text = view === 'ENG' ? formatEng(shown.exact) : view === 'S⇔D' ? toFraction(shown.exact) ?? shown.display : shown.display;
    result.textContent = `= ${text}`;
    toggle('ENG').setAttribute('aria-pressed', String(view === 'ENG'));
    toggle('S⇔D').setAttribute('aria-pressed', String(view === 'S⇔D'));
  }

  function renderMode(): void {
    const scientific = mode === 'Scientific';
    modeSelect.value = mode;
    basicPad.hidden = scientific;
    functionKeys.hidden = !scientific;
    scientificPad.hidden = !scientific;
    root.classList.toggle('is-scientific', scientific);
    const deg = toggle('DEG');
    deg.textContent = angle === 'deg' ? 'DEG' : 'RAD';
    deg.setAttribute('aria-label', `Angle unit: ${angle === 'deg' ? 'degrees' : 'radians'}. Tap to change`);
  }

  function clearResult(): void {
    result.textContent = '';
    result.classList.remove('is-error');
    steps.show(null);
    shown = null;
    view = 'normal';
    renderResult();
  }

  keys.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.key');
    const name = button?.dataset.toggle as Toggle | undefined;
    if (name === 'DEG') {
      angle = angle === 'deg' ? 'rad' : 'deg';
      savePref(ANGLE_KEY, angle);
      renderMode();
      return;
    }
    if (name) {
      if (!shown) return;
      view = view === name ? 'normal' : name;
      renderResult();
      return;
    }
    const key = button?.dataset.key as Key | '=' | undefined;
    if (!key || key === '=') return; // "=" is the submit button
    const next = applyKey({ text: input.value, start: input.selectionStart ?? input.value.length, end: input.selectionEnd ?? input.value.length, justEvaluated }, key);
    input.value = next.text;
    input.setSelectionRange(next.start, next.end);
    justEvaluated = false;
    if (key === 'AC') clearResult();
  });
  // Keypad buttons must not steal focus, or the caret position is lost on touch.
  keys.addEventListener('pointerdown', (event) => event.preventDefault());
  modeSelect.addEventListener('change', () => {
    mode = (READY_MODES as readonly string[]).includes(modeSelect.value) ? (modeSelect.value as Mode) : 'Basic';
    savePref(MODE_KEY, mode);
    renderMode();
  });
  input.addEventListener('input', () => { justEvaluated = false; });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      input.value = '';
      clearResult();
      justEvaluated = false;
    } else if (event.key === '=') {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  const historySection = el('section', 'history');
  const historyHeader = el('div', 'history-header');
  const clearButton = el('button', 'clear-history', 'Clear history');
  clearButton.type = 'button';
  historyHeader.append(el('h2', undefined, 'History'), clearButton);
  const historyList = el('div', 'history-list');
  historySection.append(historyHeader, historyList);

  function renderHistory(): void {
    clearButton.disabled = history.length === 0;
    if (history.length === 0) {
      historyList.replaceChildren(el('p', 'history-empty', 'No calculations yet. Your results will show up here.'));
      return;
    }
    historyList.replaceChildren(
      ...groupByDay(history, new Date()).map((group) => {
        const block = el('div', 'history-group');
        const list = el('ul');
        for (const entry of group.entries) {
          const item = el('li');
          item.append(el('span', 'history-expression', entry.expression), el('span', 'history-result', `= ${entry.result}`));
          list.append(item);
        }
        block.append(el('h3', undefined, group.label), list);
        return block;
      }),
    );
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const expression = input.value.trim();
    const outcome = calculate(expression, ans, { angle });
    const working = outcome.ok ? workingFor(expression, ans, { angle }) : null; // before ans changes
    result.classList.toggle('is-error', !outcome.ok);
    steps.show(working);
    view = 'normal';
    if (!outcome.ok) {
      shown = null;
      renderResult();
      result.textContent = ERROR_MESSAGES[outcome.error];
      return; // Ans stays the last successful result
    }
    ans = outcome.exact;
    justEvaluated = true;
    shown = outcome;
    renderResult();
    // Trig worked in radians is tagged, so a later look at history is not misread as degrees.
    const saved = angle === 'rad' && TRIG.test(expression) ? `${expression} [RAD]` : expression;
    history = addEntry(history, { expression: saved, result: outcome.display, exact: outcome.exact, at: new Date().toISOString() });
    saveHistory(history);
    renderHistory();
    input.select(); // next keystroke replaces the expression; arrows keep editing it
  });

  clearButton.addEventListener('click', () => {
    history = clearHistory();
    saveHistory(history);
    renderHistory();
    input.focus();
  });

  renderMode();
  renderHistory();
  root.replaceChildren(header, form, steps.element, historySection);
}
