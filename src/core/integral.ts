import type { BigNumber, MathNode } from 'mathjs';
import { MathError } from './functions';
import { math } from './math';

const big = (value: number | string) => math.bignumber(value);
// Each level halves the spacing: level 7 is about a thousand points at most.
const MAX_LEVEL = 7;
const MIN_LEVEL = 3; // enough points before trusting agreement, so a wave is not mistaken for a flat line
const T_MAX = 4; // beyond this the points sit within 1e-37 of the ends and weigh nothing
const TOLERANCE = big('1e-15');
const SHOWN_DIGITS = 13;

interface Node {
  /** Position in −1…1 and its weight; the mirror point −x has the same weight. */
  x: BigNumber;
  w: BigNumber;
}
const levels: Node[][] = [];
/** Tanh-sinh points new at this level (level 0 also holds the centre). */
function nodes(level: number): Node[] {
  if (levels[level]) return levels[level];
  const halfPi = big(-1).acos().div(2);
  const h = big(1).div(2 ** level);
  const out: Node[] = [];
  for (let j = level ? 1 : 0; j <= T_MAX * 2 ** level; j += level ? 2 : 1) {
    const t = h.times(j);
    const u = halfPi.times(t.sinh());
    out.push({ x: u.tanh(), w: halfPi.times(t.cosh()).div(u.cosh().pow(2)) });
  }
  return (levels[level] = out);
}

/**
 * Definite integral of `f` over x from a to b, numerically, like the ∫ key on a Casio.
 * Tanh-sinh rule: it never touches the two ends, so √x from 0 and 1/√x from 0 work.
 * Throws MathError when f has no value somewhere inside the range or the sum does not settle (1/x from 0).
 * shortcut: a corner inside the range (|x| across 0) does not settle either; split the range at corners if that is ever wanted.
 */
export function integrate(f: MathNode, a: unknown, b: unknown, scope: Record<string, unknown>): BigNumber {
  if (!math.isBigNumber(a) || !math.isBigNumber(b) || !a.isFinite() || !b.isFinite()) throw new MathError();
  if (a.eq(b)) return big(0);
  const code = f.compile();
  const [centre, half] = [a.plus(b).div(2), b.minus(a).div(2)];
  let absSum = big(0);
  const at = (x: BigNumber, w: BigNumber): BigNumber => {
    const y: unknown = code.evaluate({ ...scope, x: centre.plus(half.times(x)) });
    if (!math.isBigNumber(y) || !y.isFinite()) throw new MathError();
    absSum = absSum.plus(y.abs().times(w));
    return y.times(w);
  };

  let sum = big(0);
  let previous: BigNumber | null = null;
  for (let level = 0; level <= MAX_LEVEL; level++) {
    for (const { x, w } of nodes(level)) sum = sum.plus(x.isZero() ? at(x, w) : at(x, w).plus(at(x.neg(), w)));
    const h = half.div(2 ** level);
    const estimate = sum.times(h);
    // Size of the area if nothing cancelled: an answer of 0 (sin over a full turn) still has a scale to compare with.
    const scale = absSum.times(h.abs());
    if (previous && level >= MIN_LEVEL && estimate.minus(previous).abs().lte(TOLERANCE.times(scale))) {
      return estimate.abs().lt(TOLERANCE.times(scale)) ? big(0) : estimate.toSignificantDigits(SHOWN_DIGITS);
    }
    previous = estimate;
  }
  throw new MathError();
}
