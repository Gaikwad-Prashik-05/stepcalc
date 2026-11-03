import { columnWork, type ColumnWork } from './steps';
import { divisionWork, multiplicationWork } from './steps-muldiv';

/** One drawn row of working. `cells` has one entry per digit column ('' = empty). */
export interface GridLine {
  style: 'mark' | 'digit' | 'result' | 'text';
  /** Left gutter: an operator sign, or the divisor in long division. */
  gutter?: string;
  /** Gutter holds the divisor: drawn with the division bracket. */
  divisor?: boolean;
  cells: string[];
  crossed?: boolean[];
  /** Cells with a rule under them (subtraction/addition lines). */
  underline?: boolean[];
  underlineGutter?: boolean;
  /** Division bar over these cells (the dividend). */
  bar?: boolean;
  /** Show the decimal point on this row (others leave the point column empty). */
  point?: boolean;
  /** style 'text': a full-width line such as "= 3.00". */
  text?: string;
}

export interface GridWork {
  columns: number;
  /** Digit column index the decimal point sits before; null = no point column. */
  pointBefore: number | null;
  lines: GridLine[];
  notes: string[];
  /** Screen-reader summary of the whole grid. */
  label: string;
}

/** `text` right-aligned so its last character lands in column `end`. */
export function placeRight(text: string, end: number, columns: number): string[] {
  const cells = Array<string>(columns).fill('');
  [...text].forEach((ch, i) => { cells[end - text.length + 1 + i] = ch; });
  return cells;
}

function numberText(cells: string[], fractionDigits: number): string {
  const d = cells.join('') || '0';
  return fractionDigits ? `${d.slice(0, -fractionDigits) || '0'}.${d.slice(-fractionDigits)}` : d;
}

export function columnGrid(work: ColumnWork): GridWork {
  const columns = work.result.length;
  const f = work.fractionDigits;
  const sign = work.kind === 'add' ? '+' : '−';
  const last = work.rows.length - 1;
  const answer = `${work.negative ? 'minus ' : ''}${numberText(work.result, f)}`;
  return {
    columns,
    pointBefore: f ? columns - f : null,
    lines: [
      { style: 'mark', cells: work.marks },
      ...work.rows.map((cells, i): GridLine => ({
        style: 'digit',
        cells,
        point: true,
        crossed: i === 0 ? work.crossed : undefined,
        gutter: i === last ? sign : undefined,
        underline: i === last ? Array<boolean>(columns).fill(true) : undefined,
        underlineGutter: i === last,
      })),
      { style: 'result', cells: work.result, point: true, gutter: work.negative ? '−' : undefined },
    ],
    notes: work.notes,
    label: `${work.kind === 'add' ? 'Column addition' : 'Column subtraction'}: ${work.rows
      .map((r) => numberText(r, f))
      .join(work.kind === 'add' ? ' plus ' : ' minus ')} equals ${answer}`,
  };
}

/** School-method working for the expression, or null when there is none for it. */
export function stepsFor(expression: string): GridWork | null {
  const column = columnWork(expression);
  return column ? columnGrid(column) : multiplicationWork(expression) ?? divisionWork(expression);
}
