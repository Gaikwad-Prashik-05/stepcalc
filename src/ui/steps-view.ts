import type { ColumnWork } from '../core/steps';

export const NOTES_KEY = 'stepcalc.notes.v1';

function notesOn(): boolean {
  try {
    return globalThis.localStorage?.getItem(NOTES_KEY) !== 'off';
  } catch {
    return true;
  }
}

function saveNotes(on: boolean): void {
  try {
    globalThis.localStorage?.setItem(NOTES_KEY, on ? 'on' : 'off');
  } catch {
    // Blocked storage: the switch still works for this visit.
  }
}

/** One grid row: operator cell, then digit cells with the decimal point slotted in. */
function gridRow(cells: string[], fractionDigits: number, className: string, op = '', crossed?: boolean[]): HTMLElement[] {
  const out: HTMLElement[] = [];
  const cell = (text: string, extra = '') => {
    const node = document.createElement('span');
    node.className = `cell ${className} ${extra}`.trim();
    node.textContent = text;
    out.push(node);
    return node;
  };
  cell(op, 'cell-op');
  const pointAt = cells.length - fractionDigits;
  cells.forEach((text, i) => {
    if (fractionDigits && i === pointAt) cell(className === 'cell-mark' ? '' : '.', 'cell-point');
    if (crossed?.[i]) {
      const s = document.createElement('s');
      s.textContent = text;
      cell('').append(s);
    } else {
      cell(text);
    }
  });
  return out;
}

function describe(work: ColumnWork): string {
  const num = (cells: string[]) => {
    const d = cells.join('');
    return work.fractionDigits ? `${d.slice(0, -work.fractionDigits) || '0'}.${d.slice(-work.fractionDigits)}` : d;
  };
  const answer = `${work.negative ? 'minus ' : ''}${num(work.result) || '0'}`;
  const verb = work.kind === 'add' ? 'Column addition' : 'Column subtraction';
  return `${verb}: ${work.rows.map(num).join(work.kind === 'add' ? ' plus ' : ' minus ')} equals ${answer}`;
}

export function createStepsView(): { element: HTMLElement; show: (work: ColumnWork | null) => void } {
  const section = document.createElement('section');
  section.className = 'steps';
  section.hidden = true;

  const header = document.createElement('div');
  header.className = 'steps-header';
  const title = document.createElement('h2');
  title.textContent = 'Working';
  const toggleLabel = document.createElement('label');
  toggleLabel.className = 'notes-toggle';
  const toggle = document.createElement('input');
  toggle.type = 'checkbox';
  toggle.checked = notesOn();
  toggleLabel.append(toggle, ' Notes');
  header.append(title, toggleLabel);

  const grid = document.createElement('div');
  grid.className = 'column-grid';
  grid.setAttribute('role', 'img');
  const notes = document.createElement('ol');
  notes.className = 'steps-notes';
  section.append(header, grid, notes);

  toggle.addEventListener('change', () => {
    notes.hidden = !toggle.checked;
    saveNotes(toggle.checked);
  });

  function show(work: ColumnWork | null): void {
    section.hidden = !work;
    if (!work) return;
    const { fractionDigits: f } = work;
    const columns = 1 + work.result.length + (f ? 1 : 0);
    grid.style.gridTemplateColumns = `repeat(${columns}, auto)`;
    grid.setAttribute('aria-label', describe(work));
    const sign = work.kind === 'add' ? '+' : '−';
    const rule = document.createElement('span');
    rule.className = 'cell-rule';
    rule.style.gridColumn = `1 / span ${columns}`;
    grid.replaceChildren(
      ...gridRow(work.marks, f, 'cell-mark'),
      ...work.rows.flatMap((row, i) => gridRow(row, f, 'cell-digit', i === work.rows.length - 1 ? sign : '', i === 0 ? work.crossed : undefined)),
      rule,
      ...gridRow(work.result, f, 'cell-result', work.negative ? '−' : ''),
    );
    notes.replaceChildren(...work.notes.map((text) => Object.assign(document.createElement('li'), { textContent: text })));
    notes.hidden = !toggle.checked;
  }

  return { element: section, show };
}
