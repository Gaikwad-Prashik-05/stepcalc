import { calculate, ERROR_MESSAGES } from '../core/engine';
import { addEntry, clearHistory, groupByDay, type HistoryEntry } from '../core/history';
import { loadHistory, saveHistory } from './history-store';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Temporary screen until the keypad (Feature 3): type an expression, press Enter.
export function renderApp(root: HTMLElement): void {
  let ans = '0';
  let history: HistoryEntry[] = loadHistory();

  const header = el('header', 'app-header');
  header.append(el('h1', undefined, 'StepCalc'), el('p', 'tagline', 'Show my work'));

  const form = el('form', 'calc');
  const label = el('label', 'calc-label', 'Expression');
  label.htmlFor = 'expression';
  const input = el('input', 'calc-input');
  Object.assign(input, { id: 'expression', type: 'text', autocomplete: 'off', spellcheck: false, placeholder: 'e.g. 550 ÷ 600 or 50 + 10%' });
  input.setAttribute('enterkeyhint', 'done');
  const result = el('output', 'calc-result');
  result.setAttribute('for', 'expression');
  result.setAttribute('role', 'status');
  form.append(label, input, result);

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
