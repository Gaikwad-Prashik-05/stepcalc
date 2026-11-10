import { readDrawing, type Reading } from '../draw/layout';
import { PointCloudRecognizer, type Point, type Stroke } from '../draw/recognizer';
import { addSample, loadSamples, saveSamples } from './handwriting-store';
import { BUILT_IN_TEMPLATES, TEACHABLE } from '../draw/templates';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function button(className: string, text: string, label?: string): HTMLButtonElement {
  const b = el('button', className, text);
  b.type = 'button';
  if (label) b.setAttribute('aria-label', label);
  return b;
}

export interface DrawView {
  element: HTMLElement;
  /** Keeps every symbol the user fixed by tapping as a handwriting sample. Call when the answer was accepted. */
  learnFromCorrections(): void;
}

/** Canvas for handwriting, the "Read as" line with tap-to-fix, and the Teach screen. */
export function createDrawView(onRead: (expression: string) => void, onEquals: () => void): DrawView {
  const samples = loadSamples();
  const recognizer = new PointCloudRecognizer(BUILT_IN_TEMPLATES);
  for (const [label, list] of Object.entries(samples)) for (const sample of list) recognizer.add(label, sample);
  // Real handwriting from many people (its own file, fetched once and kept offline with the rest of the app).
  void import('../draw/handwriting-data').then(({ HANDWRITING }) => {
    for (const [label, packed] of Object.entries(HANDWRITING)) recognizer.addPacked(label, packed);
    cache = new Map();
    if (strokes.length) update();
  });

  let strokes: Stroke[] = [];
  let current: Stroke | null = null;
  let choices = new Map<string, string>();
  const learned = new Set<string>();
  let reading: Reading | null = null;
  // Symbol key → alternatives; a key is its stroke numbers, so it stays valid until strokes are removed.
  let cache = new Map<string, string[]>();
  let teaching = false;

  const section = el('section', 'draw');
  section.setAttribute('aria-label', 'Draw');
  const readAs = el('div', 'read-as');
  readAs.setAttribute('aria-live', 'polite');
  const canvas = el('canvas', 'draw-canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Drawing area: write an expression with your finger, pen or mouse');
  const tools = el('div', 'draw-tools');
  const undo = button('draw-button', 'Undo', 'Undo last stroke');
  const clear = button('draw-button', 'Clear', 'Clear drawing');
  const teach = button('draw-button', 'Teach', 'Teach my handwriting');
  const equals = button('draw-button draw-equals', '=', 'Work it out');
  tools.append(undo, clear, teach, equals);

  const teachPanel = el('div', 'teach');
  teachPanel.hidden = true;
  const teachLabel = el('label', 'teach-row');
  const symbolSelect = el('select', 'convert-select');
  for (const label of TEACHABLE) symbolSelect.append(Object.assign(el('option', undefined, label === 'x' ? 'x (also ×)' : label), { value: label }));
  teachLabel.append(el('span', undefined, 'Symbol'), symbolSelect);
  const count = el('span', 'teach-count');
  const saveSample = button('draw-button draw-equals', 'Save sample');
  const done = button('draw-button', 'Done');
  const teachActions = el('div', 'teach-row');
  teachActions.append(count, saveSample, done);
  teachPanel.append(el('p', 'teach-hint', 'Draw the symbol on the canvas the way you usually write it, then save. Three or four samples of each one work best.'), teachLabel, teachActions);
  section.append(readAs, teachPanel, canvas, tools);

  // Drawing
  const ctx = canvas.getContext('2d');
  function redraw(): void {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = ctx.fillStyle = getComputedStyle(canvas).color;
    ctx.lineWidth = 3;
    ctx.lineCap = ctx.lineJoin = 'round';
    for (const stroke of current ? [...strokes, current] : strokes) {
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      if (stroke.length === 1) ctx.lineTo(stroke[0].x + 0.1, stroke[0].y);
      for (const point of stroke.slice(1)) ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }
  }
  function fit(): void {
    const { width, height } = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
    redraw();
  }
  new ResizeObserver(fit).observe(canvas);
  const at = (event: PointerEvent): Point => ({ x: event.offsetX, y: event.offsetY });

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button > 0) return;
    canvas.setPointerCapture(event.pointerId);
    current = [at(event)];
    redraw();
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!current) return;
    const events = event.getCoalescedEvents?.() ?? [event];
    current.push(...(events.length ? events : [event]).map(at));
    redraw();
  });
  const finish = () => {
    if (!current) return;
    strokes.push(current);
    current = null;
    update();
  };
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);

  // Reading
  function renderReadAs(): void {
    if (!reading?.tokens.length) {
      readAs.replaceChildren(el('span', 'read-as-empty', 'Write a sum below, like 2x + 3 = 11 or an integral with its limits'));
      return;
    }
    readAs.replaceChildren(
      el('span', 'read-as-label', 'Read as'),
      ...reading.tokens.map((token) => {
        if (!token.key || !token.alternatives || token.alternatives.length < 2) return el('span', 'read-text', token.text);
        const b = button('read-token', token.text, `${token.text}: tap to change to ${token.alternatives[1]}`);
        b.addEventListener('click', () => {
          choices.set(token.key!, token.alternatives![1]);
          learned.delete(token.key!);
          update();
        });
        return b;
      }),
    );
  }

  function update(): void {
    redraw();
    if (teaching) return;
    reading = readDrawing(strokes, recognizer, choices, cache);
    renderReadAs();
    onRead(reading.expression);
  }

  function reset(): void {
    strokes = [];
    cache = new Map();
    choices = new Map();
    learned.clear();
    update();
  }

  undo.addEventListener('click', () => {
    const removed = String(strokes.length - 1);
    strokes.pop();
    for (const key of [...cache.keys()]) if (key.split('|')[0].split(',').includes(removed)) cache.delete(key);
    // Choices that involved the removed stroke no longer apply.
    for (const key of [...choices.keys()]) if (key.replace('fn:', '').split(',').includes(removed)) choices.delete(key);
    update();
  });
  clear.addEventListener('click', reset);
  equals.addEventListener('click', onEquals);

  // Teach
  const showCount = () => {
    const n = samples[symbolSelect.value]?.length ?? 0;
    count.textContent = n === 1 ? '1 saved' : `${n} saved`;
  };
  teach.addEventListener('click', () => {
    teaching = true;
    teachPanel.hidden = false;
    readAs.hidden = true;
    tools.hidden = true;
    showCount();
    reset();
  });
  symbolSelect.addEventListener('change', showCount);
  saveSample.addEventListener('click', () => {
    if (!strokes.length) return;
    const sample = addSample(samples, symbolSelect.value, strokes);
    if (sample) recognizer.add(symbolSelect.value, sample);
    saveSamples(samples);
    strokes = [];
    redraw();
    showCount();
  });
  done.addEventListener('click', () => {
    teaching = false;
    teachPanel.hidden = true;
    readAs.hidden = false;
    tools.hidden = false;
    reset();
  });

  function learnFromCorrections(): void {
    if (!reading) return;
    let changed = false;
    for (const [key, label] of choices) {
      const ids = reading.symbols.get(key);
      if (!ids || learned.has(key)) continue;
      const target = label === '×' ? 'x' : label === '∫(' ? '∫' : label;
      const sample = addSample(samples, target, ids.map((i) => strokes[i]));
      if (!sample) continue;
      recognizer.add(target, sample);
      learned.add(key);
      cache = new Map(); // readings may change now that it knows this handwriting
      changed = true;
    }
    if (changed) saveSamples(samples);
  }

  renderReadAs();
  return { element: section, learnFromCorrections };
}
