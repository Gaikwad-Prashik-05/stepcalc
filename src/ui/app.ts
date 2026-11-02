import { calculate, ERROR_MESSAGES } from '../core/engine';
import { addEntry, clearHistory, groupByDay, type HistoryEntry } from '../core/history';
import { applyKey, type Key } from '../core/keypad';
import { loadHistory, saveHistory } from './history-store';

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
const KEY_LABELS: Partial<Record<Key | '=', string>> = { '⌫': 'Backspace', AC: 'All clear', '−': 'Minus', '×': 'Times', '÷': 'Divide by' };
const MODES = ['Basic', 'Scientific', 'Conversion', 'Draw'];

export function renderApp(root: HTMLElement): void {
  let ans = '0';
  let justEvaluated = false;
  let history: HistoryEntry[] = loadHistory();

  const header = el('header', 'app-header');
  const title = el('div');
  title.append(el('h1', undefined, 'StepCalc'), el('p', 'tagline', 'Show my work'));
  const mode = el('select', 'mode-select');
  mode.setAttribute('aria-label', 'Mode');
  for (const name of MODES) {
    const option = el('option', undefined, name === 'Basic' ? name : `${name} (soon)`);
    option.disabled = name !== 'Basic';
    mode.append(option);
  }
  header.append(title, mode);

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

  const keypad = el('div', 'keypad');
  for (const key of KEYS) {
    const button = el('button', 'key', key);
    button.type = key === '=' ? 'submit' : 'button';
    button.dataset.key = key;
    if (KEY_LABELS[key]) button.setAttribute('aria-label', KEY_LABELS[key]);
    if (key === '=') button.classList.add('key-equals');
    else if (['÷', '×', '−', '+', '%'].includes(key)) button.classList.add('key-op');
    else if (key === 'AC' || key === '⌫') button.classList.add('key-fn');
    keypad.append(button);
  }
  form.append(label, input, result, keypad);

  keypad.addEventListener('click', (event) => {
    const key = (event.target as HTMLElement).closest<HTMLButtonElement>('.key')?.dataset.key as Key | '=' | undefined;
    if (!key || key === '=') return; // "=" is the submit button
    const next = applyKey({ text: input.value, start: input.selectionStart ?? input.value.length, end: input.selectionEnd ?? input.value.length, justEvaluated }, key);
    input.value = next.text;
    input.setSelectionRange(next.start, next.end);
    justEvaluated = false;
    if (key === 'AC') { result.textContent = ''; result.classList.remove('is-error'); }
  });
  // Keypad buttons must not steal focus, or the caret position is lost on touch.
  keypad.addEventListener('pointerdown', (event) => event.preventDefault());
  input.addEventListener('input', () => { justEvaluated = false; });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      input.value = '';
      result.textContent = '';
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
    const outcome = calculate(expression, ans);
    result.classList.toggle('is-error', !outcome.ok);
    if (!outcome.ok) {
      result.textContent = ERROR_MESSAGES[outcome.error];
      return; // Ans stays the last successful result
    }
    ans = outcome.exact;
    justEvaluated = true;
    result.textContent = `= ${outcome.display}`;
    history = addEntry(history, { expression, result: outcome.display, exact: outcome.exact, at: new Date().toISOString() });
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

  renderHistory();
  root.replaceChildren(header, form, historySection);
}
