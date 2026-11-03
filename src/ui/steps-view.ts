import type { Working } from '../core/breakdown';
import type { GridLine, GridWork } from '../core/steps-grid';

export const NOTES_KEY = 'stepcalc.notes.v1';
export const STEPS_KEY = 'stepcalc.steps.v1';

function preference(key: string): boolean {
  try {
    return globalThis.localStorage?.getItem(key) !== 'off';
  } catch {
    return true;
  }
}

function savePreference(key: string, on: boolean): void {
  try {
    globalThis.localStorage?.setItem(key, on ? 'on' : 'off');
  } catch {
    // Blocked storage: the switch still works for this visit.
  }
}

function switchControl(className: string, text: string, key: string, onChange: (on: boolean) => void): { label: HTMLLabelElement; input: HTMLInputElement } {
  const label = document.createElement('label');
  label.className = className;
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = preference(key);
  label.append(input, ` ${text}`);
  input.addEventListener('change', () => {
    savePreference(key, input.checked);
    onChange(input.checked);
  });
  return { label, input };
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

/** Grid plus its numbered notes. */
function renderGrid(work: GridWork): HTMLElement[] {
  const grid = document.createElement('div');
  grid.className = 'column-grid';
  grid.setAttribute('role', 'img');
  grid.setAttribute('aria-label', work.label);
  grid.style.gridTemplateColumns = `repeat(${1 + work.columns + (work.pointBefore === null ? 0 : 1)}, auto)`;
  grid.append(...work.lines.flatMap((line) => renderLine(line, work)));
  const notes = document.createElement('ol');
  notes.className = 'steps-notes';
  notes.append(...work.notes.map((text) => Object.assign(document.createElement('li'), { textContent: text })));
  return [grid, notes];
}

function renderWorking(working: Working): HTMLElement[] {
  if (working.kind === 'grid') return renderGrid(working.grid);
  const list = document.createElement('ol');
  list.className = 'breakdown';
  list.append(Object.assign(document.createElement('li'), { className: 'breakdown-start', textContent: working.start }));
  for (const step of working.steps) {
    const item = document.createElement('li');
    const line = [span('breakdown-line', step.line), span('breakdown-op', step.op)];
    if (step.detail) {
      // Each operation opens into its own column / long-division working.
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.append(...line);
      const body = document.createElement('div');
      body.className = 'breakdown-detail';
      body.append(...renderGrid(step.detail));
      details.append(summary, body);
      item.append(details);
    } else {
      item.className = 'breakdown-plain';
      item.append(...line);
    }
    list.append(item);
  }
  return [list];
}

export function createStepsView(): { element: HTMLElement; switchElement: HTMLElement; show: (working: Working | null) => void } {
  const section = document.createElement('section');
  section.className = 'steps';
  section.hidden = true;
  let current: Working | null = null;

  const header = document.createElement('div');
  header.className = 'steps-header';
  const title = document.createElement('h2');
  title.textContent = 'Working';
  const notes = switchControl('notes-toggle', 'Notes', NOTES_KEY, (on) => section.classList.toggle('notes-off', !on));
  section.classList.toggle('notes-off', !notes.input.checked);
  header.append(title, notes.label);
  const body = document.createElement('div');
  body.className = 'steps-body';
  section.append(header, body);

  // Master switch, shown in the app header: off hides the working entirely.
  const steps = switchControl('steps-toggle', 'Steps', STEPS_KEY, () => show(current));

  function show(working: Working | null): void {
    current = working;
    section.hidden = !working || !steps.input.checked;
    if (section.hidden) return;
    body.replaceChildren(...renderWorking(working!));
  }

  return { element: section, switchElement: steps.label, show };
}
