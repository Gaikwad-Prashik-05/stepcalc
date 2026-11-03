import type { BigNumber, MathNode } from 'mathjs';
import { evaluationScope, lettersIn, MAX_LENGTH, parseExpression, type CalcError, type CalcOptions } from './engine';
import { math } from './math';

export type SolveResult =
  | { ok: true; unknown: string; roots: string[]; more: boolean }
  | { ok: false; error: CalcError };

const MAX_ROOTS = 4;
// The page is frozen while this runs, so it stops after a few seconds (a long chain of sin(x) can take a minute).
const DEFAULT_BUDGET_MS = 3000;
const BISECTIONS = 220;
// A real root lands near 1e-60 at 64-digit precision; a pole (1/x = 0) or a jump stays large.
const ROOT_TOLERANCE = math.bignumber('1e-20');
const big = (x: number | string) => math.bignumber(x);

/** Points to look for sign changes: dense around 0, then spreading out to ±1e15. */
function searchPoints(): BigNumber[] {
  const points = new Map<string, BigNumber>();
  const add = (x: BigNumber) => points.set(x.toString(), x);
  for (let i = -400; i <= 400; i++) add(big(i).div(4));
  for (let k = -6; k <= 15; k++) {
    for (const m of ['1', '1.5', '2', '3', '5', '7']) {
      const x = big(m).times(big(10).pow(k));
      add(x);
      add(x.neg());
    }
  }
  return [...points.values()].sort((a, b) => a.comparedTo(b));
}
const SEARCH_POINTS = searchPoints();

/**
 * Solves an equation like `2x + 3 = 11` numerically for its one letter without a value.
 * Finds sign changes on a fixed grid, bisects each to 64 digits and drops poles.
 */
export function solve(equation: string, ans: string, options: CalcOptions = {}, budgetMs = DEFAULT_BUDGET_MS): SolveResult {
  const deadline = performance.now() + budgetMs;
  const late = () => performance.now() > deadline;
  if (equation.length > MAX_LENGTH) return { ok: false, error: 'invalid' };
  const sides = equation.split('=');
  if (sides.length !== 2 || !sides[0].trim() || !sides[1].trim()) return { ok: false, error: 'invalid' };

  const letters = lettersIn(equation);
  const unknowns = letters.filter((l) => options.vars?.[l] === undefined);
  if (unknowns.length !== 1) return { ok: false, error: 'solve-one-unknown' };
  const unknown = unknowns[0];

  let node: MathNode;
  try {
    node = parseExpression(`(${sides[0]}) - (${sides[1]})`, new Set(letters));
  } catch {
    return { ok: false, error: 'invalid' };
  }
  const scope = evaluationScope(ans, options);
  const code = node.compile();
  const f = (x: BigNumber): BigNumber | null => {
    try {
      const value: unknown = code.evaluate({ ...scope, [unknown]: x });
      return math.isBigNumber(value) && value.isFinite() ? value : null;
    } catch {
      return null; // outside the domain here (√ of a negative, log 0, …)
    }
  };

  const found: BigNumber[] = [];
  const addRoot = (x: BigNumber) => {
    const value = f(x);
    if (!value || value.abs().gt(ROOT_TOLERANCE)) return;
    // A decimal that is "really" exact (3.99999…→4) is preferred when it fits at least as well.
    const snapped = x.toDecimalPlaces(30);
    const snappedValue = f(snapped);
    const root = snappedValue && snappedValue.abs().lte(value.abs()) ? snapped : x.toSignificantDigits(40);
    const close = (r: BigNumber) => r.minus(root).abs().lte(big('1e-20').times(root.abs().plus(1)));
    if (!found.some(close)) found.push(root.isZero() ? big(0) : root);
  };

  // Brackets first, then refine only the ones nearest 0: sin(x) = 0 has dozens on the grid.
  const brackets: { lo: BigNumber; hi: BigNumber; fLo: BigNumber | null }[] = [];
  let previous: { x: BigNumber; y: BigNumber } | null = null;
  for (const [n, x] of SEARCH_POINTS.entries()) {
    if (n % 16 === 0 && late()) return { ok: false, error: 'solve-too-slow' };
    const y = f(x);
    if (!y) {
      previous = null;
      continue;
    }
    if (y.isZero()) brackets.push({ lo: x, hi: x, fLo: null });
    else if (previous && !previous.y.isZero() && previous.y.isNeg() !== y.isNeg()) brackets.push({ lo: previous.x, hi: x, fLo: previous.y });
    previous = { x, y };
  }
  const distance = (b: { lo: BigNumber; hi: BigNumber }) => (b.lo.abs().lt(b.hi.abs()) ? b.lo.abs() : b.hi.abs());
  brackets.sort((a, b) => distance(a).comparedTo(distance(b)));

  let next = 0;
  // Some brackets are poles (tan 90°) and get rejected, so keep going until enough real roots.
  while (next < brackets.length && found.length <= MAX_ROOTS && !late()) {
    const { lo, hi, fLo } = brackets[next++];
    addRoot(fLo ? bisect(f, lo, hi, fLo, late) : lo);
  }

  if (!found.length) return { ok: false, error: next < brackets.length ? 'solve-too-slow' : 'no-solution' };
  const more = found.length > MAX_ROOTS || next < brackets.length;
  // Nearest 0 first (positive before negative, like a calculator's principal value);
  // a complete list reads left to right instead (x = −2 or 2).
  found.sort((a, b) => a.abs().comparedTo(b.abs()) || b.comparedTo(a));
  const shown = found.slice(0, MAX_ROOTS);
  if (!more) shown.sort((a, b) => a.comparedTo(b));
  return { ok: true, unknown, roots: shown.map((r) => r.toString()), more };
}

function bisect(f: (x: BigNumber) => BigNumber | null, lo: BigNumber, hi: BigNumber, fLo: BigNumber, late: () => boolean): BigNumber {
  let [a, b, fa] = [lo, hi, fLo];
  for (let i = 0; i < BISECTIONS && !late(); i++) {
    const mid = a.plus(b).div(2);
    const fm = f(mid);
    if (!fm) return mid; // undefined inside the bracket: let the root check reject it
    if (fm.isZero()) return mid;
    if (fm.isNeg() === fa.isNeg()) [a, fa] = [mid, fm];
    else b = mid;
    if (b.minus(a).abs().lte(big('1e-50').times(a.abs().plus(1)))) break;
  }
  return a.plus(b).div(2);
}
