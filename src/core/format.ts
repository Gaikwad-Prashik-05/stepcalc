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
  const intDigits = value.abs().lt(1) ? 0 : value.abs().floor().toFixed().length;
  const rounded =
    intDigits > SIGNIFICANT_DIGITS
      ? value.toDecimalPlaces(0, ROUND_HALF_UP)
      : value.toSignificantDigits(SIGNIFICANT_DIGITS, ROUND_HALF_UP);
  if (rounded.isZero()) return '0';

  const abs = rounded.abs();
  if (abs.gte(EXPONENT_AT_OR_ABOVE) || abs.lt(EXPONENT_BELOW)) return rounded.toExponential();

  const [intPart, fracPart] = rounded.toFixed().split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fracPart ? `${grouped}.${fracPart}` : grouped;
}
