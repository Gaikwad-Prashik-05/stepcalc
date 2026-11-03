import { calculate } from './engine';
import { math } from './math';
import { placeName } from './steps';
import { placeRight, type GridLine, type GridWork } from './steps-grid';

const MAX_COLUMNS = 24;
const MAX_MULTIPLIER_DIGITS = 6;
const MAX_DIVISOR_DIGITS = 12;
const MAX_DECIMALS = 6;
const NUMBER = '(\\d+(?:\\.\\d+)?|\\.\\d+)';
const ROUND_DOWN = 1; // decimal.js rounding mode

function parse(expression: string, ops: string): [string, string] | null {
  const match = new RegExp(`^\\s*${NUMBER}\\s*[${ops}]\\s*${NUMBER}\\s*$`).exec(expression);
  return match ? [match[1], match[2]] : null;
}

/** "02.50" → { digits: "250", places: 2 }: the number with its point taken out. */
function wholeDigits(n: string): { digits: string; places: number } {
  const [int, frac = ''] = n.split('.');
  return { digits: (int + frac).replace(/^0+(?=\d)/, ''), places: frac.length };
}

/** Puts the point back `places` from the right: ("300", 2) → "3.00". */
function withPoint(digits: string, places: number): string {
  if (!places) return digits;
  const padded = digits.padStart(places + 1, '0');
  return `${padded.slice(0, -places)}.${padded.slice(-places)}`;
}

function matchesEngine(expression: string, answer: string, decimalsShown: number | null): boolean {
  const engine = calculate(expression);
  if (!engine.ok) return false;
  const exact = math.bignumber(engine.exact);
  // A cut-off division shows only some decimals: compare against the engine truncated to them.
  const expected = decimalsShown === null ? exact : exact.toDecimalPlaces(decimalsShown, ROUND_DOWN);
  return expected.eq(math.bignumber(answer));
}

export function multiplicationWork(expression: string): GridWork | null {
  const parsed = parse(expression, '×*');
  if (!parsed) return null;
  const [aText, bText] = parsed;
  const a = wholeDigits(aText);
  const b = wholeDigits(bText);
  if (b.digits.length > MAX_MULTIPLIER_DIGITS) return null;

  const A = BigInt(a.digits);
  const product = String(A * BigInt(b.digits));
  const multiDigit = b.digits.length > 1;
  const partials = [...b.digits].reverse().map((d, k) => String(A * BigInt(d)) + '0'.repeat(k));
  const columns = Math.max(a.digits.length, b.digits.length, product.length, ...partials.map((p) => p.length));
  if (columns > MAX_COLUMNS) return null;
  const end = columns - 1;
  const notes: string[] = [];
  const places = a.places + b.places;
  if (places) notes.push(`Ignore the points for now: ${a.digits} × ${b.digits}.`);

  const lines: GridLine[] = [];
  if (multiDigit) {
    lines.push({ style: 'digit', cells: placeRight(a.digits, end, columns) });
    lines.push({ style: 'digit', cells: placeRight(b.digits, end, columns), gutter: '×', underline: Array(columns).fill(true), underlineGutter: true });
    partials.forEach((row, k) => {
      const isLast = k === partials.length - 1;
      lines.push({
        style: 'digit',
        cells: placeRight(row, end, columns),
        gutter: isLast ? '+' : undefined,
        underline: isLast ? Array(columns).fill(true) : undefined,
        underlineGutter: isLast,
      });
      const digit = b.digits[b.digits.length - 1 - k];
      const shift = k ? `, shifted ${k} place${k > 1 ? 's' : ''} left (write ${k} zero${k > 1 ? 's' : ''})` : '';
      notes.push(`${a.digits} × ${digit} (${placeName(end - k, columns, 0).toLowerCase()} digit) = ${A * BigInt(digit)}${shift} → ${row}`);
    });
    notes.push(`Add the rows: ${partials.join(' + ')} = ${product}`);
  } else {
    // One-digit multiplier: work column by column with carries, like on paper.
    const d = Number(b.digits);
    const marks = Array<string>(columns).fill('');
    let carry = 0;
    for (let i = a.digits.length - 1; i >= 0; i--) {
      const col = end - (a.digits.length - 1 - i);
      const v = Number(a.digits[i]) * d + carry;
      const name = placeName(col, columns, 0);
      const sum = `${a.digits[i]} × ${d}${carry ? ` + ${carry}` : ''} = ${v}`;
      if (i === 0) notes.push(`${name}: ${sum}, write ${v}`);
      else if (v >= 10) notes.push(`${name}: ${sum}, write ${v % 10} carry ${Math.floor(v / 10)}`);
      else notes.push(`${name}: ${sum}`);
      carry = Math.floor(v / 10);
      if (carry && i > 0) marks[col - 1] = String(carry);
    }
    lines.push({ style: 'mark', cells: marks });
    lines.push({ style: 'digit', cells: placeRight(a.digits, end, columns) });
    lines.push({ style: 'digit', cells: placeRight(b.digits, end, columns), gutter: '×', underline: Array(columns).fill(true), underlineGutter: true });
  }
  lines.push({ style: 'result', cells: placeRight(product, end, columns) });

  const answer = withPoint(product, places);
  if (places) {
    notes.push(`${aText} has ${a.places} decimal place${a.places === 1 ? '' : 's'} and ${bText} has ${b.places}, so put the point ${places} place${places === 1 ? '' : 's'} from the right: ${answer}`);
    lines.push({ style: 'text', cells: [], text: `= ${answer}` });
  }
  if (!matchesEngine(expression, answer, null)) return null;
  return { columns, pointBefore: null, lines, notes, label: `Long multiplication: ${aText} times ${bText} equals ${answer}` };
}

interface DivisionStep { end: number; shown: string; product: bigint; remainder: bigint; first: boolean }

export function divisionWork(expression: string): GridWork | null {
  const parsed = parse(expression, '÷/');
  if (!parsed) return null;
  const [aText, bText] = parsed;
  if (math.bignumber(bText).isZero()) return null;
  const notes: string[] = [];

  // A decimal divisor is made whole first: 7.5 ÷ 0.25 → 750 ÷ 25.
  const scale = wholeDigits(bText).places;
  const factor = math.bignumber(10).pow(scale);
  const dividend = math.bignumber(aText).times(factor).toFixed();
  const divisorText = math.bignumber(bText).times(factor).toFixed();
  if (scale) notes.push(`Make the divisor whole: multiply both numbers by ${factor.toFixed()} → ${dividend} ÷ ${divisorText}`);
  if (divisorText.length > MAX_DIVISOR_DIGITS) return null;
  const d = BigInt(divisorText);

  const [intPart, fracPart = ''] = dividend.split('.');
  const digits = [...intPart, ...fracPart];
  let pointBefore: number | null = fracPart ? intPart.length : null;
  const quotient: string[] = [];
  const steps: DivisionStep[] = [];
  const seen = new Map<bigint, number>();
  let rem = 0n;
  let started = false;
  let ending = '';

  for (let i = 0; ; i++) {
    if (i >= digits.length) {
      if (rem === 0n) break;
      if (pointBefore === null) {
        pointBefore = digits.length;
        notes.push(`No digits left but remainder ${rem}: put a point in the answer and bring down zeros.`);
      }
      const repeatFrom = seen.get(rem);
      if (repeatFrom !== undefined) {
        ending = `Remainder ${rem} came back, so the digits ${quotient.slice(repeatFrom).join('')} repeat forever.`;
        break;
      }
      if (i - pointBefore >= MAX_DECIMALS) {
        ending = `Stopped after ${MAX_DECIMALS} decimal places; the answer keeps going.`;
        break;
      }
      seen.set(rem, i);
      digits.push('0');
    }
    const cur = rem * 10n + BigInt(digits[i]);
    const q = cur / d;
    const lastWholeDigit = i >= (pointBefore ?? digits.length) - 1;
    if (!started && q === 0n && !lastWholeDigit) {
      quotient.push(''); // school skips leading zeros: take more digits first
      rem = cur;
      continue;
    }
    const product = q * d;
    const shown = started ? `${rem}${digits[i]}` : String(cur);
    const times = `${d} goes into ${cur} ${q} time${q === 1n ? '' : 's'}: ${q} × ${d} = ${product}, ${cur} − ${product} = ${cur - product}`;
    notes.push(started ? `Bring down ${digits[i]} → ${cur}. ${times}` : times);
    steps.push({ end: i, shown, product, remainder: cur - product, first: !started });
    quotient.push(String(q));
    started = true;
    rem = cur - product;
  }

  const columns = digits.length;
  if (columns > MAX_COLUMNS) return null;
  const decimals = pointBefore === null ? 0 : columns - pointBefore;
  const qDigits = quotient.join('');
  const answer = decimals ? `${qDigits.slice(0, -decimals) || '0'}.${qDigits.slice(-decimals)}` : qDigits;
  notes.push(ending || `Remainder 0, so ${aText} ÷ ${bText} = ${answer}`);
  if (!matchesEngine(expression, answer, ending ? decimals : null)) return null;

  const lines: GridLine[] = [
    { style: 'result', cells: quotient, point: true },
    { style: 'digit', cells: digits, gutter: divisorText, divisor: true, bar: true, point: true },
  ];
  for (const step of steps) {
    if (!step.first) lines.push({ style: 'digit', cells: placeRight(step.shown, step.end, columns) });
    const productText = String(step.product);
    const width = Math.max(productText.length, step.shown.length);
    lines.push({
      style: 'digit',
      cells: placeRight(productText, step.end, columns),
      gutter: '−',
      underline: placeRight('x'.repeat(width), step.end, columns).map(Boolean),
    });
  }
  const lastEnd = steps.at(-1)?.end ?? columns - 1;
  lines.push({ style: 'digit', cells: placeRight(String(rem), lastEnd, columns) });

  return {
    columns,
    pointBefore,
    lines,
    notes,
    label: `Long division: ${aText} divided by ${bText} equals ${answer}${ending ? ' and keeps going' : ''}`,
  };
}
