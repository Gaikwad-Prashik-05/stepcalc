import type { GridLine, GridWork } from '../core/steps-grid';

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

function span(className: string, text = ''): HTMLSpanElement {
  const node = document.createElement('span');
  node.className = className;
  node.textContent = text;
  return node;
}

/** One grid row: gutter cell, then digit cells with the decimal point column slotted in. */
function renderLine(line: GridLine, work: GridWork): HTMLElement[] {
  if (line.style === 'text') {
    const node = span('cell cell-text', line.text);
    node.style.gridColumn = '1 / -1';
    return [node];
  }
  const kind = `cell-${line.style}`;
  const gutter = span(`cell cell-op ${kind}`, line.gutter ?? '');
  if (line.divisor) gutter.classList.add('cell-divisor');
  if (line.underlineGutter) gutter.classList.add('cell-u');
  const out: HTMLElement[] = [gutter];
  line.cells.forEach((text, i) => {
    if (i === work.pointBefore) {
      const point = span(`cell cell-point ${kind}`, line.point ? '.' : '');
      if (line.bar) point.classList.add('cell-bar');
      if (line.underline?.[i] && line.underline[i - 1]) point.classList.add('cell-u');
      out.push(point);
    }
    const cell = span(`cell ${kind}`);
    if (line.crossed?.[i]) cell.append(Object.assign(document.createElement('s'), { textContent: text }));
    else cell.textContent = text;
    if (line.underline?.[i]) cell.classList.add('cell-u');
    if (line.bar) cell.classList.add('cell-bar');
    out.push(cell);
  });
  return out;
}

export function createStepsView(): { element: HTMLElement; show: (work: GridWork | null) => void } {
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

  function show(work: GridWork | null): void {
    section.hidden = !work;
    if (!work) return;
    const columns = 1 + work.columns + (work.pointBefore === null ? 0 : 1);
    grid.style.gridTemplateColumns = `repeat(${columns}, auto)`;
    grid.setAttribute('aria-label', work.label);
    grid.replaceChildren(...work.lines.flatMap((line) => renderLine(line, work)));
    notes.replaceChildren(...work.notes.map((text) => Object.assign(document.createElement('li'), { textContent: text })));
    notes.hidden = !toggle.checked;
  }

  return { element: section, show };
}
