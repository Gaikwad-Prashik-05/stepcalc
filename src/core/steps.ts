import { calculate } from './engine';
import { math } from './math';

/** School-method column working for a plain addition or subtraction. All arrays run left to right. */
export interface ColumnWork {
  kind: 'add' | 'sub';
  /** How many of the columns are after the decimal point (0 = whole numbers). */
  fractionDigits: number;
  /** Small digits above the top row: carries (add) or the top digit's new value after borrowing (sub). */
  marks: string[];
  /** Operands, one per row; '' is an empty cell. For subtraction the bigger number is on top. */
  rows: string[][];
  /** Subtraction: top-row digits that changed by borrowing (drawn crossed out). */
  crossed: boolean[];
  result: string[];
  negative: boolean;
  /** One line per column, right to left, plus an opening line when the numbers were swapped. */
  notes: string[];
}

const MAX_COLUMNS = 24;
const NUMBER = /^(?:\d+(?:\.\d+)?|\.\d+)$/;
const INT_PLACES = ['Ones', 'Tens', 'Hundreds', 'Thousands', 'Ten-thousands', 'Hundred-thousands', 'Millions', 'Ten-millions', 'Hundred-millions'];
const FRACTION_PLACES = ['Tenths', 'Hundredths', 'Thousandths', 'Ten-thousandths'];

/** Place name of column `col` in a grid `width` wide with `fractionDigits` decimal columns. */
function placeName(col: number, width: number, fractionDigits: number): string {
  const power = width - fractionDigits - 1 - col; // 0 = ones, -1 = tenths
  if (power >= 0) return INT_PLACES[power] ?? `10^${power} place`;
  return FRACTION_PLACES[-power - 1] ?? `10^${power} place`;
}

function parse(expression: string): { op: '+' | '-'; numbers: string[] } | null {
  const tokens = expression.trim().split(/\s*([+\-−–])\s*/);
  const numbers = tokens.filter((_, i) => i % 2 === 0);
  const ops = new Set(tokens.filter((_, i) => i % 2 === 1).map((op) => (op === '+' ? '+' : '-')));
  if (numbers.length < 2 || ops.size !== 1 || !numbers.every((n) => NUMBER.test(n))) return null;
  const op = ops.has('+') ? '+' : '-';
  if (op === '-' && numbers.length !== 2) return null;
  return { op, numbers };
}

/** Splits numbers into aligned digit rows: int part right-aligned (blank-padded), fraction zero-padded. */
function align(numbers: string[]): { rows: string[][]; fractionDigits: number } {
  const split = numbers.map((n) => {
    const [int, frac = ''] = n.split('.');
    return { int: int.replace(/^0+(?=\d)/, '') || '0', frac };
  });
  const intLen = Math.max(...split.map((s) => s.int.length));
  const fractionDigits = Math.max(...split.map((s) => s.frac.length));
  const rows = split.map(({ int, frac }) => [
    ...Array<string>(intLen - int.length).fill(''),
    ...int,
    ...frac.padEnd(fractionDigits, '0'),
  ]);
  return { rows, fractionDigits };
}

const digit = (cell: string | undefined) => (cell ? Number(cell) : 0);

/** Leading zeros of the whole-number part become blanks; the ones digit always stays. */
function blankLeadingZeros(result: string[], fractionDigits: number): string[] {
  const out = [...result];
  for (let i = 0; i < out.length - fractionDigits - 1 && out[i] === '0'; i++) out[i] = '';
  return out;
}

function addition(rows: string[][], fractionDigits: number): ColumnWork {
  const width = rows[0].length;
  const marks = Array<string>(width).fill('');
  const result = Array<string>(width).fill('');
  const notes: string[] = [];
  let carry = 0;
  for (let col = width - 1; col >= 0; col--) {
    const cells = rows.map((r) => r[col]).filter(Boolean);
    const sum = cells.reduce((s, c) => s + Number(c), 0) + carry;
    const terms = carry ? [...cells, String(carry)] : cells;
    const name = placeName(col, width, fractionDigits);
    result[col] = String(sum % 10);
    if (terms.length === 1) notes.push(`${name}: bring down ${sum}`);
    else if (sum >= 10) notes.push(`${name}: ${terms.join(' + ')} = ${sum}, write ${sum % 10} carry ${Math.floor(sum / 10)}`);
    else notes.push(`${name}: ${terms.join(' + ')} = ${sum}`);
    carry = Math.floor(sum / 10);
    if (carry && col > 0) marks[col - 1] = String(carry);
  }

  // A final carry becomes new columns on the left (e.g. 99 + 1, or 9 + 9 + 9 carrying 2).
  const extra = carry ? [...String(carry)] : [];
  const pad = (row: string[]) => [...Array<string>(extra.length).fill(''), ...row];
  if (extra.length) {
    const newWidth = width + extra.length;
    notes.push(`${placeName(extra.length - 1, newWidth, fractionDigits)}: carried ${carry}, write ${carry}`);
    marks.unshift(...pad([]));
    marks[extra.length - 1] = String(carry);
  }
  return {
    kind: 'add',
    fractionDigits,
    marks,
    rows: rows.map(pad),
    crossed: Array<boolean>(width + extra.length).fill(false),
    result: blankLeadingZeros([...extra, ...result], fractionDigits),
    negative: false,
    notes,
  };
}

function subtraction(top: string[], bottom: string[], fractionDigits: number, swapped: string | null): ColumnWork {
  const width = top.length;
  const work = top.map(digit);
  const changed = Array<boolean>(width).fill(false);
  const result = Array<string>(width).fill('0');
  const notes: (string | null)[] = [];
  for (let col = width - 1; col >= 0; col--) {
    const b = digit(bottom[col]);
    const name = placeName(col, width, fractionDigits);
    if (work[col] < b) {
      // Borrow from the nearest non-zero digit on the left; the zeros in between become 9.
      let from = col - 1;
      while (work[from] === 0) from--;
      work[from]--;
      changed[from] = true;
      for (let k = from + 1; k < col; k++) { work[k] = 9; changed[k] = true; }
      const before = work[col];
      work[col] += 10;
      changed[col] = true;
      notes.push(`${name}: ${before} < ${b}, borrow 1 → ${work[col]} − ${b} = ${work[col] - b}`);
    } else if (!bottom[col]) {
      notes.push(null); // filled below, once we know whether it is a leading zero
    } else {
      notes.push(`${name}: ${work[col]} − ${b} = ${work[col] - b}`);
    }
    result[col] = String(work[col] - b);
  }

  const shown = blankLeadingZeros(result, fractionDigits);
  const columnNotes = notes.map((note, i) => {
    if (note !== null) return note;
    const col = width - 1 - i;
    const name = placeName(col, width, fractionDigits);
    return shown[col] === '' ? `${name}: ${work[col]}, nothing left to write` : `${name}: bring down ${work[col]}`;
  });
  return {
    kind: 'sub',
    fractionDigits,
    marks: work.map((v, i) => (changed[i] ? String(v) : '')),
    rows: [top, bottom],
    crossed: changed,
    result: shown,
    negative: swapped !== null,
    notes: swapped ? [swapped, ...columnNotes] : columnNotes,
  };
}

function toNumber(cells: string[], fractionDigits: number, negative: boolean): string {
  const digits = cells.join('') || '0';
  const text = fractionDigits ? `${digits.slice(0, -fractionDigits) || '0'}.${digits.slice(-fractionDigits)}` : digits;
  return `${negative ? '-' : ''}${text}`;
}

/** Column working for `a + b + …` or `a − b` with plain non-negative numbers, else null. */
export function columnWork(expression: string): ColumnWork | null {
  const parsed = parse(expression);
  if (!parsed) return null;
  const { rows, fractionDigits } = align(parsed.numbers);
  if (rows[0].length > MAX_COLUMNS) return null;

  let work: ColumnWork;
  if (parsed.op === '+') {
    work = addition(rows, fractionDigits);
  } else {
    const [a, b] = parsed.numbers;
    const swap = math.bignumber(a).lt(math.bignumber(b));
    const [top, bottom] = swap ? [rows[1], rows[0]] : [rows[0], rows[1]];
    const note = swap ? `${b} is bigger than ${a}, so work out ${b} − ${a} and make the answer negative.` : null;
    work = subtraction(top, bottom, fractionDigits, note);
  }
  if (work.result.length > MAX_COLUMNS) return null;

  // Safety net: never show working whose answer differs from the engine's.
  const engine = calculate(expression);
  const answer = toNumber(work.result, fractionDigits, work.negative);
  return engine.ok && math.bignumber(answer).eq(math.bignumber(engine.exact)) ? work : null;
}
