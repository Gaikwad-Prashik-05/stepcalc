import type { Recognizer, Stroke } from './recognizer';

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** One piece of the "Read as" line. Tappable pieces carry the symbol they came from. */
export interface Token {
  text: string;
  /** Stroke indices joined ("3,4"): stable id of the drawn symbol, for tap-to-fix. */
  key?: string;
  /** What tapping cycles through, current reading first. */
  alternatives?: string[];
}

export interface Reading {
  tokens: Token[];
  expression: string;
  /** Strokes of each tappable symbol, for learning from corrections. */
  symbols: Map<string, number[]>;
}

/** Shapes that are easy to mix up; the layout offers them as alternatives. */
const LOOK_ALIKE: Record<string, string[]> = {
  '1': ['l', 'i'], l: ['1', 'i'], i: ['1', 'l'], '0': ['o'], o: ['0'], '5': ['s'], s: ['5'], '9': ['g'], g: ['9'],
  x: ['×', '+'], '×': ['x', '+'], '+': ['t', 'x'], t: ['+'], '(': ['c'], c: ['('], y: ['4'], '4': ['y'],
};
const FUNCTION_NAMES = ['sin', 'cos', 'tan', 'log', 'ln'];
const DIGIT = /^[\d.]$/;
const CAN_TAKE_POWER = /^[\da-zπ)]$/;

type Item =
  | { kind: 'symbol'; box: Box; key: string; strokes: number[]; alternatives: string[] }
  | { kind: 'fraction'; box: Box; top: Item[]; bottom: Item[] }
  | { kind: 'root'; box: Box; inside: Item[] };

const width = (b: Box) => b.maxX - b.minX;
const height = (b: Box) => b.maxY - b.minY;
const cx = (b: Box) => (b.minX + b.maxX) / 2;
const cy = (b: Box) => (b.minY + b.maxY) / 2;
function boxOf(points: { x: number; y: number }[]): Box {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}
const union = (boxes: Box[]): Box => ({
  minX: Math.min(...boxes.map((b) => b.minX)), minY: Math.min(...boxes.map((b) => b.minY)),
  maxX: Math.max(...boxes.map((b) => b.maxX)), maxY: Math.max(...boxes.map((b) => b.maxY)),
});

/**
 * Reads strokes as an expression: fraction bars and √ first, then symbols grouped by overlap,
 * then powers and function names. `choices` holds labels the user picked by tapping (by symbol key).
 */
export function readDrawing(
  strokes: Stroke[],
  recognizer: Recognizer,
  choices: ReadonlyMap<string, string> = new Map(),
  /** Alternatives per symbol key from the last reading: unchanged symbols are not recognised again. */
  cache: Map<string, string[]> = new Map(),
): Reading {
  const boxes = strokes.map(boxOf);
  const sizes = boxes.map((b) => Math.max(width(b), height(b))).sort((a, b) => a - b);
  // Typical symbol size: the median stroke, so one long fraction bar does not skew it.
  const unit = sizes.length ? sizes[Math.floor(sizes.length / 2)] || 1 : 1;
  const isDot = (i: number) => Math.max(width(boxes[i]), height(boxes[i])) < 0.18 * unit;
  const isFlat = (i: number) => !isDot(i) && height(boxes[i]) < 0.25 * width(boxes[i]);
  const isInk = (i: number) => !isDot(i) && !isFlat(i);
  const symbols = new Map<string, number[]>();

  function readRegion(ids: number[]): Item[] {
    let rest = [...ids];
    const items: Item[] = [];

    // Fraction bars: flat strokes with real symbols above and below; widest first.
    for (const bar of [...rest].filter(isFlat).sort((a, b) => width(boxes[b]) - width(boxes[a]))) {
      if (!rest.includes(bar)) continue;
      const b = boxes[bar];
      const over = rest.filter((i) => i !== bar && cx(boxes[i]) > b.minX && cx(boxes[i]) < b.maxX);
      const top = over.filter((i) => cy(boxes[i]) < cy(b));
      const bottom = over.filter((i) => cy(boxes[i]) > cy(b));
      if (!top.some(isInk) || !bottom.some(isInk)) continue;
      items.push({ kind: 'fraction', box: union([b, ...over.map((i) => boxes[i])]), top: readRegion(top), bottom: readRegion(bottom) });
      rest = rest.filter((i) => i !== bar && !over.includes(i));
    }

    // √: a stroke whose right part covers other strokes sitting below its top line.
    for (const root of [...rest].filter(isInk).sort((a, b) => width(boxes[b]) - width(boxes[a]))) {
      if (!rest.includes(root)) continue;
      const r = boxes[root];
      if (width(r) < 0.9 * height(r)) continue;
      const inside = rest.filter((i) => {
        const o = boxes[i];
        return i !== root && o.minX > r.minX + 0.2 * width(r) && o.maxX < r.maxX + 0.15 * unit && o.minY > r.minY + 0.05 * unit && o.maxY < r.maxY + 0.3 * unit;
      });
      if (!inside.some(isInk)) continue;
      items.push({ kind: 'root', box: union([r, ...inside.map((i) => boxes[i])]), inside: readRegion(inside) });
      rest = rest.filter((i) => i !== root && !inside.includes(i));
    }

    // Symbols: strokes that overlap horizontally belong together (+, =, ÷, i, 4).
    const groups: number[][] = [];
    for (const i of [...rest].sort((a, b) => boxes[a].minX - boxes[b].minX)) {
      const b = boxes[i];
      // Thin strokes (the upright of + or 4, the dot of i) count as a little wide, or they never overlap.
      const span = (box: Box): [number, number] => {
        const pad = Math.max(0, 0.15 * unit - width(box)) / 2;
        return [box.minX - pad, box.maxX + pad];
      };
      const [l1, r1] = span(b);
      const group = groups.find((g) => g.some((j) => {
        const [l2, r2] = span(boxes[j]);
        return Math.min(r1, r2) - Math.max(l1, l2) >= 0.5 * Math.min(r1 - l1, r2 - l2);
      }));
      if (group) group.push(i);
      else groups.push([i]);
    }
    for (const group of groups) {
      const key = [...group].sort((a, b) => a - b).join(',');
      symbols.set(key, group);
      const alternatives = cache.get(key) ?? classify(group);
      cache.set(key, alternatives);
      items.push({ kind: 'symbol', box: union(group.map((i) => boxes[i])), key, strokes: group, alternatives });
    }
    return items.sort((a, b) => a.box.minX - b.box.minX);
  }

  function classify(group: number[]): string[] {
    const dots = group.filter(isDot);
    const flats = group.filter(isFlat);
    if (dots.length === group.length) return ['.'];
    if (flats.length === group.length) return flats.length === 1 ? ['−'] : ['='];
    if (flats.length === 1 && dots.length === 2 && group.length === 3) return ['÷'];
    const ranked = recognizer.recognize(group.map((i) => strokes[i])).slice(0, 3).map((a) => a.label);
    const out: string[] = [];
    for (const label of [ranked[0], ...(LOOK_ALIKE[ranked[0]] ?? []), ...ranked.slice(1)]) if (label && !out.includes(label)) out.push(label);
    return out.slice(0, 5);
  }

  const items = readRegion(strokes.map((_, i) => i));
  const tokens = linearize(items, choices);
  return { tokens, expression: tokens.map((t) => t.text).join(''), symbols };
}

function chosen(item: Extract<Item, { kind: 'symbol' }>, choices: ReadonlyMap<string, string>): string {
  return choices.get(item.key) ?? item.alternatives[0];
}

/** Items left to right as tokens: powers for raised symbols, brackets for fractions and roots, function names. */
function linearize(items: Item[], choices: ReadonlyMap<string, string>): Token[] {
  const tokens: Token[] = [];
  const labelOf = (item: Item | undefined) => (item?.kind === 'symbol' ? chosen(item, choices) : item ? ')' : '');

  // Which items start a function name (sin, cos, …) and how many letters it uses.
  const functionAt = new Map<number, string>();
  const blocked = new Set<number>(); // letters of a function name the user turned back into letters
  for (let i = 0; i < items.length; i++) {
    const first = items[i];
    if (first.kind === 'symbol') {
      const undone = FUNCTION_NAMES.find((n) => choices.get(`fn:${first.key}`) === n.split('').join('·'));
      if (undone) for (let k = 0; k < undone.length; k++) blocked.add(i + k);
    }
  }
  for (let i = 0; i < items.length; i++) {
    for (const name of FUNCTION_NAMES) {
      const letters = items.slice(i, i + name.length);
      const fits = letters.length === name.length && letters.every((item, k) => {
        if (blocked.has(i + k)) return false;
        if (item.kind !== 'symbol') return false;
        const options = choices.has(item.key) ? [choices.get(item.key)!] : item.alternatives;
        return options.includes(name[k]);
      });
      if (fits && !functionAt.has(i)) functionAt.set(i, name);
    }
  }

  let i = 0;
  let base: Item | undefined; // what a raised symbol would be the power of
  while (i < items.length) {
    const item = items[i];
    const name = functionAt.get(i);
    if (name) {
      tokens.push({ text: name, key: `fn:${(items[i] as { key: string }).key}`, alternatives: [name, name.split('').join('·')] });
      i += name.length;
      // The argument gets brackets unless they were written: sin30 → sin(30).
      if (items[i]?.kind === 'symbol' && chosen(items[i] as Extract<Item, { kind: 'symbol' }>, choices) === '(') continue;
      tokens.push({ text: '(' });
      const start = i;
      while (i < items.length && (i === start || (items[i].kind === 'symbol' && DIGIT.test(labelOf(items[i])) && DIGIT.test(labelOf(items[i - 1]))))) {
        tokens.push(...tokensFor(items[i], items[i - 1], items[i + 1], choices));
        i++;
      }
      tokens.push({ text: ')' });
      base = items[i - 1];
      continue;
    }
    const raised = base && isRaised(item, base);
    if (raised) {
      tokens.push({ text: '^(' });
      while (i < items.length && isRaised(items[i], base!)) {
        tokens.push(...tokensFor(items[i], items[i - 1], items[i + 1], choices));
        i++;
      }
      tokens.push({ text: ')' });
      continue;
    }
    tokens.push(...tokensFor(item, items[i - 1], items[i + 1], choices));
    base = CAN_TAKE_POWER.test(labelOf(item)) ? item : undefined;
    i++;
  }
  return tokens;
}

const NEVER_RAISED = new Set(['=', '÷', '.']);

/** A smaller symbol whose centre sits in the top third of the symbol before it, or higher. */
function isRaised(item: Item, base: Item): boolean {
  if (item.kind === 'symbol' && NEVER_RAISED.has(item.alternatives[0])) return false;
  return cy(item.box) < base.box.minY + 0.35 * height(base.box) && height(item.box) < 0.85 * height(base.box);
}

function tokensFor(item: Item, before: Item | undefined, after: Item | undefined, choices: ReadonlyMap<string, string>): Token[] {
  if (item.kind === 'fraction') return [{ text: '(' }, ...linearize(item.top, choices), { text: ')÷(' }, ...linearize(item.bottom, choices), { text: ')' }];
  if (item.kind === 'root') return [{ text: '√(' }, ...linearize(item.inside, choices), { text: ')' }];
  let alternatives = item.alternatives;
  if (alternatives[0] === 'x') {
    // An x between two numbers is a times sign; anywhere else it is the letter.
    const numberish = (other: Item | undefined, edge: RegExp) =>
      other !== undefined && (other.kind !== 'symbol' || edge.test(choices.get(other.key) ?? other.alternatives[0]));
    if (numberish(before, /^[\d)]$/) && numberish(after, /^[\d(]$/)) alternatives = ['×', 'x', '+', ...alternatives.slice(1).filter((a) => !['×', 'x', '+'].includes(a))];
  }
  const text = choices.get(item.key) ?? alternatives[0];
  const cycle = [text, ...alternatives.filter((a) => a !== text)];
  return [{ text, key: item.key, alternatives: cycle }];
}
