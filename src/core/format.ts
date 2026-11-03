import { math } from './math';

const SIGNIFICANT_DIGITS = 12;
const ROUND_HALF_UP = 4; // decimal.js rounding mode, what calculators use
const EXPONENT_AT_OR_ABOVE = math.bignumber('1e15');
const EXPONENT_BELOW = math.bignumber('1e-9');

/**
 * Display string for an exact decimal: 12 significant digits, but digits before the
 * decimal point are never rounded away; thousands separators; exponent for extremes.
 */
export function formatNumber(exact: string): string {
  const value = math.bignumber(exact);
  // From the exponent, not toFixed(): 9^9^9 has ~370 million integer digits.
  const intDigits = value.abs().lt(1) ? 0 : value.e + 1;
  const rounded =
    intDigits > SIGNIFICANT_DIGITS
      ? value.toDecimalPlaces(0, ROUND_HALF_UP)
      : value.toSignificantDigits(SIGNIFICANT_DIGITS, ROUND_HALF_UP);
  if (rounded.isZero()) return '0';

  const abs = rounded.abs();
  if (abs.gte(EXPONENT_AT_OR_ABOVE) || abs.lt(EXPONENT_BELOW)) {
    return rounded.toSignificantDigits(SIGNIFICANT_DIGITS, ROUND_HALF_UP).toExponential();
  }

  const [intPart, fracPart] = rounded.toFixed().split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fracPart ? `${grouped}.${fracPart}` : grouped;
}

const SUPERSCRIPT: Record<string, string> = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

/** Engineering notation: mantissa 1–999 with 12 significant digits, exponent a multiple of 3. */
export function formatEng(exact: string): string {
  const value = math.bignumber(exact).toSignificantDigits(SIGNIFICANT_DIGITS, ROUND_HALF_UP);
  if (value.isZero()) return '0';
  // value.e is the decimal exponent; rounding above may already have carried 999.99… up to 1000.
  const exponent = Math.floor(value.e / 3) * 3;
  const mantissa = value.div(math.bignumber(10).pow(exponent)).toSignificantDigits(SIGNIFICANT_DIGITS, ROUND_HALF_UP).toFixed();
  if (exponent === 0) return mantissa;
  return `${mantissa}×10${String(exponent).replace(/./g, (c) => SUPERSCRIPT[c])}`;
}

const MAX_DENOMINATOR = 10_000;
const FRACTION_TOLERANCE = math.bignumber('1e-40');

/** The answer as a fraction (continued fractions), or null when it is whole or not a small fraction. */
export function toFraction(exact: string): string | null {
  const value = math.bignumber(exact);
  if (value.isInteger() || !value.isFinite()) return null;
  const target = value.abs();
  // Convergents h/k of the continued fraction of |value|.
  let [h0, h1, k0, k1] = [math.bignumber(0), math.bignumber(1), math.bignumber(1), math.bignumber(0)];
  let x = target;
  for (let i = 0; i < 64; i++) {
    const a = x.floor();
    [h0, h1] = [h1, a.times(h1).plus(h0)];
    [k0, k1] = [k1, a.times(k1).plus(k0)];
    if (k1.gt(MAX_DENOMINATOR)) return null;
    if (h1.div(k1).minus(target).abs().lte(FRACTION_TOLERANCE.times(target.plus(1)))) {
      return `${value.isNeg() ? '-' : ''}${formatNumber(h1.toFixed())}/${formatNumber(k1.toFixed())}`;
    }
    const rest = x.minus(a);
    if (rest.isZero()) return null;
    x = math.bignumber(1).div(rest);
  }
  return null;
}
