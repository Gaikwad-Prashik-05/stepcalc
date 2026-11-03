import type { BigNumber } from 'mathjs';
import { math } from './math';

export type AngleUnit = 'deg' | 'rad';

/** Thrown for results that do not exist (√−1, log 0, tan 90°, 2.5!): shown as "Math error". */
export class MathError extends Error {}
export class DivideByZero extends Error {}

const big = (value: number | string) => math.bignumber(value);
export const PI = big(-1).acos();
export const E = big(1).exp();
const MAX_FACTORIAL = 3000;
const TINY = big('1e-40');

/** Trims the last few digits of precision noise: sin(π) → 0, 8^(1/3) → 2. */
function clean(x: BigNumber): BigNumber {
  if (x.isNaN()) throw new MathError();
  return x.abs().lt(TINY) ? big(0) : x.toSignificantDigits(40);
}

function integer(x: BigNumber): number {
  if (!x.isInteger() || x.isNeg() || x.gt(MAX_FACTORIAL)) throw new MathError();
  return x.toNumber();
}

/** from × (from+1) × … × to, exactly. */
function product(from: number, to: number): bigint {
  let result = 1n;
  for (let i = Math.max(from, 2); i <= to; i++) result *= BigInt(i);
  return result;
}

/** Every function an expression may call, for the given angle unit. Names are what the parser sees. */
export function functionScope(angle: AngleUnit): Record<string, (...args: BigNumber[]) => BigNumber> {
  const deg = angle === 'deg';
  const toRad = (x: BigNumber) => (deg ? x.times(PI).div(180) : x);
  const fromRad = (x: BigNumber) => (deg ? x.times(180).div(PI) : x);
  // Exact answers at multiples of 90° where π/180 rounding would leave 1e-64 behind.
  const degMod = (x: BigNumber, m: number) => deg && x.mod(m).isZero();

  return {
    sin: (x) => (degMod(x, 180) ? big(0) : clean(toRad(x).sin())),
    cos: (x) => (degMod(x.minus(90), 180) ? big(0) : clean(toRad(x).cos())),
    tan: (x) => {
      if (degMod(x.minus(90), 180)) throw new MathError();
      return degMod(x, 180) ? big(0) : clean(toRad(x).tan());
    },
    asin: (x) => fromRadClean(x.abs().gt(1) ? big(NaN) : x.asin(), fromRad),
    acos: (x) => fromRadClean(x.abs().gt(1) ? big(NaN) : x.acos(), fromRad),
    atan: (x) => fromRadClean(x.atan(), fromRad),
    log: (x) => {
      if (x.lte(0)) throw new MathError();
      return clean(x.log(10));
    },
    ln: (x) => {
      if (x.lte(0)) throw new MathError();
      return clean(x.ln());
    },
    exp: (x) => clean(x.exp()),
    sqrt: (x) => {
      if (x.isNeg()) throw new MathError();
      return clean(x.sqrt());
    },
    cbrt: (x) => clean(x.cbrt()),
    root: (x, n) => {
      // root(x, n) = ⁿ√x; odd roots of negatives are real.
      if (!n || n.isZero() || !n.isInteger()) throw new MathError();
      if (x.isNeg()) {
        if (n.mod(2).isZero()) throw new MathError();
        return clean(x.neg().pow(big(1).div(n))).neg();
      }
      return clean(x.pow(big(1).div(n)));
    },
    abs: (x) => x.abs(),
    fact: (x) => big(product(1, integer(x)).toString()),
    nCr: (n, r) => {
      const [a, b] = [integer(n), integer(r)];
      if (b > a) throw new MathError();
      const k = Math.min(b, a - b);
      return big((product(a - k + 1, a) / product(1, k)).toString());
    },
    nPr: (n, r) => {
      const [a, b] = [integer(n), integer(r)];
      if (b > a) throw new MathError();
      return big(product(a - b + 1, a).toString());
    },
    mod: (a, b) => {
      if (!b || b.isZero()) throw new DivideByZero();
      return a.minus(b.times(a.div(b).floor()));
    },
  };
}

function fromRadClean(x: BigNumber, fromRad: (x: BigNumber) => BigNumber): BigNumber {
  return clean(fromRad(clean(x)));
}

export const FUNCTION_NAMES = new Set(Object.keys(functionScope('rad')));
