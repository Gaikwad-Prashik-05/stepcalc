import { calculate, ERROR_MESSAGES, lettersIn, type CalcError } from '../core/engine';
import { formatEng, formatNumber, toFraction } from '../core/format';
import type { AngleUnit } from '../core/functions';
import { addEntry, clearHistory, groupByDay, type HistoryEntry } from '../core/history';
import { applyKey, type Key } from '../core/keypad';
import { workingFor } from '../core/breakdown';
import { solve } from '../core/solver';
import { CATEGORIES, conversionWorking, convert, UNITS, type Category } from '../core/units';
import { resolveValues } from '../core/variables';
import { loadHistory, saveHistory } from './history-store';
import { ANGLE_KEY, loadJson, loadPref, MODE_KEY, saveJson, savePref, UNITS_KEY } from './prefs';
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
  '(', ')', ',', 'abs', 'x', 'eq',
];
const TOGGLES = new Set<string>(['DEG', 'ENG', 'S⇔D']);
const KEY_LABELS: Partial<Record<Key | '=' | Toggle, string>> = {
  '⌫': 'Backspace', AC: 'All clear', '−': 'Minus', '×': 'Times', '÷': 'Divide by',
  ENG: 'Engineering notation', 'S⇔D': 'Show as fraction', π: 'Pi', e: 'e', '±': 'Change sign',
  'sin⁻¹': 'Inverse sine', 'cos⁻¹': 'Inverse cosine', 'tan⁻¹': 'Inverse tangent', log: 'Log base 10', ln: 'Natural log',
  '√': 'Square root', '∛': 'Cube root', 'ⁿ√': 'Nth root', '10ˣ': 'Ten to the power', 'eˣ': 'e to the power',
  'x²': 'Square', 'xʸ': 'Power', 'x!': 'Factorial', ',': 'Comma', abs: 'Absolute value',
  x: 'Letter x', eq: 'Equals sign, to write an equation',
};
const KEY_TEXT: Partial<Record<Key | '=' | Toggle, string>> = { eq: '=' };
const MODES = ['Basic', 'Scientific', 'Conversion', 'Draw'] as const;
const READY_MODES = ['Basic', 'Scientific', 'Conversion'] as const;
type Mode = (typeof READY_MODES)[number];
const TRIG = /sin|cos|tan/;

/** Letters that need a value box: all of them, except in an equation with one letter, which is just solved. */
function lettersToFill(expression: string): string[] {
  const letters = lettersIn(expression);
  return expression.includes('=') && letters.length === 1 ? [] : letters;
}

interface UnitChoice {
  category: Category;
  pairs: Record<Category, [string, string]>;
}
const DEFAULT_UNITS: UnitChoice = {
  category: 'Length',
  pairs: {
    Length: ['km', 'mi'], Mass: ['kg', 'lb'], Temperature: ['°C', '°F'], Area: ['m²', 'ft²'],
    Volume: ['L', 'gal'], Data: ['GB', 'MB'], Time: ['h', 'min'], Speed: ['km/h', 'mph'],
  },
};
function isUnitChoice(value: unknown): value is UnitChoice {
  const v = value as UnitChoice | null;
  if (typeof v !== 'object' || v === null || !CATEGORIES.includes(v.category) || typeof v.pairs !== 'object' || v.pairs === null) return false;
  return CATEGORIES.every((c) => {
    const pair = v.pairs[c];
    return Array.isArray(pair) && pair.length === 2 && pair.every((id) => UNITS[c].some((unit) => unit.id === id));
  });
}

function buildKeys(keys: readonly (Key | '=' | Toggle)[], className: string): HTMLDivElement {
  const keypad = el('div', className);
  for (const key of keys) {
    const button = el('button', 'key', KEY_TEXT[key] ?? key);
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
  // What is typed in each letter's value box; kept while the letter comes and goes.
  const valueTexts: Record<string, string> = {};
  const units: UnitChoice = loadJson(UNITS_KEY, isUnitChoice, structuredClone(DEFAULT_UNITS));
  // The last value converted, so changing a unit updates the answer straight away.
  let converted: { expression: string; exact: string } | null = null;

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
  const valueBoxes = el('div', 'value-boxes');
  valueBoxes.hidden = true;
  const convertPanel = el('div', 'convert');
  const categorySelect = el('select', 'convert-select convert-category');
  categorySelect.setAttribute('aria-label', 'Unit type');
  for (const category of CATEGORIES) categorySelect.append(Object.assign(el('option', undefined, category), { value: category }));
  const fromSelect = el('select', 'convert-select');
  fromSelect.setAttribute('aria-label', 'From unit');
  const toSelect = el('select', 'convert-select');
  toSelect.setAttribute('aria-label', 'To unit');
  const swapButton = el('button', 'convert-swap', '⇄');
  swapButton.type = 'button';
  swapButton.setAttribute('aria-label', 'Swap units');
  const unitRow = el('div', 'convert-units');
  unitRow.append(fromSelect, swapButton, toSelect);
  convertPanel.append(categorySelect, unitRow);
  form.append(label, input, valueBoxes, result, convertPanel, keys);

  function renderUnits(): void {
    const [from, to] = units.pairs[units.category];
    categorySelect.value = units.category;
    for (const [select, chosen] of [[fromSelect, from], [toSelect, to]] as const) {
      select.replaceChildren(...UNITS[units.category].map((unit) => Object.assign(el('option', undefined, `${unit.id} · ${unit.name}`), { value: unit.id })));
      select.value = chosen;
    }
  }

  /** Shows a value converted with the current units; steps follow the Steps switch. */
  function showConversion(): void {
    if (!converted) return;
    const [from, to] = units.pairs[units.category];
    const exact = convert(converted.exact, units.category, from, to);
    result.classList.remove('is-error');
    result.textContent = `= ${formatNumber(exact)} ${to}`;
    steps.show(conversionWorking(converted.exact, units.category, from, to));
    ans = exact;
  }

  function changeUnits(): void {
    saveJson(UNITS_KEY, units);
    renderUnits();
    showConversion();
  }
  categorySelect.addEventListener('change', () => {
    units.category = categorySelect.value as Category;
    changeUnits();
  });
  fromSelect.addEventListener('change', () => {
    units.pairs[units.category][0] = fromSelect.value;
    changeUnits();
  });
  toSelect.addEventListener('change', () => {
    units.pairs[units.category][1] = toSelect.value;
    changeUnits();
  });
  swapButton.addEventListener('click', () => {
    units.pairs[units.category].reverse();
    changeUnits();
  });

  /** One box per letter in the expression; existing boxes are kept so typing in them is not interrupted. */
  function renderValueBoxes(): void {
    const letters = lettersToFill(input.value);
    valueBoxes.hidden = letters.length === 0;
    const existing = new Map([...valueBoxes.querySelectorAll<HTMLInputElement>('input')].map((box) => [box.dataset.letter!, box]));
    if (letters.join() === [...existing.keys()].join()) return;
    valueBoxes.replaceChildren(
      ...letters.map((letter) => {
        const field = el('label', 'value-box');
        const box = existing.get(letter) ?? el('input');
        Object.assign(box, { type: 'text', autocomplete: 'off', spellcheck: false, value: valueTexts[letter] ?? '' });
        box.dataset.letter = letter;
        box.setAttribute('inputmode', 'decimal');
        box.setAttribute('aria-label', `Value of ${letter}`);
        field.append(el('span', 'value-letter', `${letter} =`), box);
        return field;
      }),
    );
  }
  valueBoxes.addEventListener('input', (event) => {
    const box = event.target as HTMLInputElement;
    valueTexts[box.dataset.letter!] = box.value;
    box.removeAttribute('aria-invalid');
  });
  valueBoxes.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  const box = (letter: string) => valueBoxes.querySelector<HTMLInputElement>(`input[data-letter="${letter}"]`);
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
    convertPanel.hidden = mode !== 'Conversion';
    root.classList.toggle('is-scientific', scientific);
    root.classList.toggle('is-conversion', mode === 'Conversion');
    const deg = toggle('DEG');
    deg.textContent = angle === 'deg' ? 'DEG' : 'RAD';
    deg.setAttribute('aria-label', `Angle unit: ${angle === 'deg' ? 'degrees' : 'radians'}. Tap to change`);
  }

  function clearResult(): void {
    result.textContent = '';
    result.classList.remove('is-error');
    steps.show(null);
    shown = null;
    converted = null;
    view = 'normal';
    for (const letter of Object.keys(valueTexts)) delete valueTexts[letter];
    valueBoxes.replaceChildren(); // rebuilt empty, so no box shows a forgotten value
    renderValueBoxes();
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
    renderValueBoxes();
  });
  // Keypad buttons must not steal focus, or the caret position is lost on touch.
  keys.addEventListener('pointerdown', (event) => event.preventDefault());
  modeSelect.addEventListener('change', () => {
    mode = (READY_MODES as readonly string[]).includes(modeSelect.value) ? (modeSelect.value as Mode) : 'Basic';
    savePref(MODE_KEY, mode);
    clearResult();
    renderMode();
  });
  input.addEventListener('input', () => {
    justEvaluated = false;
    renderValueBoxes();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      input.value = '';
      clearResult();
      justEvaluated = false;
      renderValueBoxes();
    } else if (event.key === '=' && !input.value.includes('=') && lettersIn(input.value).length === 0) {
      // Phone habit: "=" works the answer out. With letters it writes an equation instead.
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
          // Solved equations already read "x = 4".
          item.append(el('span', 'history-expression', entry.expression), el('span', 'history-result', entry.result.includes('=') ? entry.result : `= ${entry.result}`));
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
    const values = resolveValues(lettersToFill(expression), valueTexts, ans, { angle });
    const options = { angle, vars: values.vars };
    view = 'normal';
    shown = null;
    converted = null;
    const fail = (error: CalcError, focus?: string) => {
      result.classList.add('is-error');
      steps.show(null);
      renderResult();
      result.textContent = ERROR_MESSAGES[error];
      if (focus) box(focus)?.focus();
    };
    for (const letter of values.bad) box(letter)?.setAttribute('aria-invalid', 'true');
    if (values.bad.length) return fail('invalid', values.bad[0]);

    let resultText: string;
    let exact: string;
    if (expression.includes('=')) {
      const solved = solve(expression, ans, options);
      if (!solved.ok) return fail(solved.error, solved.error === 'solve-one-unknown' && values.empty.length > 1 ? values.empty[0] : undefined);
      resultText = `${solved.unknown} = ${solved.roots.map(formatNumber).join(' or ')}${solved.more ? ' or …' : ''}`;
      exact = solved.roots[0];
      steps.show(null); // no algebra steps for equations yet
      result.classList.remove('is-error');
      result.textContent = resultText;
    } else if (mode === 'Conversion') {
      const outcome = calculate(expression, ans, options);
      if (!outcome.ok) return fail(outcome.error, outcome.error === 'missing-value' ? values.empty[0] : undefined);
      converted = { expression, exact: outcome.exact };
      showConversion(); // sets ans
      const [from, to] = units.pairs[units.category];
      justEvaluated = true;
      history = addEntry(history, { expression: `${expression} ${from} → ${to}`, result: `${result.textContent!.slice(2)}`, exact: ans, at: new Date().toISOString() });
      saveHistory(history);
      renderHistory();
      input.select();
      return;
    } else {
      const outcome = calculate(expression, ans, options);
      if (!outcome.ok) return fail(outcome.error, outcome.error === 'missing-value' ? values.empty[0] : undefined);
      steps.show(workingFor(expression, ans, options)); // before ans changes
      result.classList.remove('is-error');
      shown = outcome;
      renderResult();
      resultText = outcome.display;
      exact = outcome.exact;
    }
    ans = exact;
    justEvaluated = true;
    // Trig worked in radians is tagged, so a later look at history is not misread as degrees.
    const given = Object.keys(values.vars).map((letter) => `${letter} = ${valueTexts[letter].trim()}`);
    let saved = given.length && !expression.includes('=') ? `${expression} (${given.join(', ')})` : expression;
    if (angle === 'rad' && TRIG.test(expression)) saved += ' [RAD]';
    history = addEntry(history, { expression: saved, result: resultText, exact, at: new Date().toISOString() });
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

  renderUnits();
  renderMode();
  renderHistory();
  root.replaceChildren(header, form, steps.element, historySection);
}
