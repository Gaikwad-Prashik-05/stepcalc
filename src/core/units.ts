import type { BigNumber } from 'mathjs';
import type { BreakdownStep, Working } from './breakdown';
import { workingFor } from './breakdown';
import { formatNumber } from './format';
import { math } from './math';
import { stepsFor } from './steps-grid';

export const CATEGORIES = ['Length', 'Mass', 'Temperature', 'Area', 'Volume', 'Data', 'Time', 'Speed'] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Unit {
  /** Symbol, also used as the id. */
  id: string;
  name: string;
  /** Size in the category's base unit, exact: a decimal or a fraction "a/b". Temperature has none. */
  factor?: string;
}

const u = (id: string, name: string, factor?: string): Unit => ({ id, name, factor });

// Exact definitions (international yard and pound, US customary volumes); base units: m, kg, m², L, B, s, m/s.
export const UNITS: Record<Category, Unit[]> = {
  Length: [
    u('km', 'Kilometre', '1000'), u('m', 'Metre', '1'), u('cm', 'Centimetre', '0.01'), u('mm', 'Millimetre', '0.001'),
    u('µm', 'Micrometre', '0.000001'), u('nm', 'Nanometre', '0.000000001'), u('mi', 'Mile', '1609.344'), u('yd', 'Yard', '0.9144'),
    u('ft', 'Foot', '0.3048'), u('in', 'Inch', '0.0254'), u('nmi', 'Nautical mile', '1852'),
  ],
  Mass: [
    u('t', 'Tonne', '1000'), u('kg', 'Kilogram', '1'), u('g', 'Gram', '0.001'), u('mg', 'Milligram', '0.000001'),
    u('µg', 'Microgram', '0.000000001'), u('st', 'Stone', '6.35029318'), u('lb', 'Pound', '0.45359237'), u('oz', 'Ounce', '0.028349523125'),
  ],
  Temperature: [u('°C', 'Celsius'), u('°F', 'Fahrenheit'), u('K', 'Kelvin')],
  Area: [
    u('km²', 'Square kilometre', '1000000'), u('ha', 'Hectare', '10000'), u('m²', 'Square metre', '1'), u('cm²', 'Square centimetre', '0.0001'),
    u('mm²', 'Square millimetre', '0.000001'), u('mi²', 'Square mile', '2589988.110336'), u('acre', 'Acre', '4046.8564224'),
    u('yd²', 'Square yard', '0.83612736'), u('ft²', 'Square foot', '0.09290304'), u('in²', 'Square inch', '0.00064516'),
  ],
  Volume: [
    u('m³', 'Cubic metre', '1000'), u('L', 'Litre', '1'), u('mL', 'Millilitre', '0.001'), u('cm³', 'Cubic centimetre', '0.001'),
    u('gal', 'US gallon', '3.785411784'), u('qt', 'US quart', '0.946352946'), u('pt', 'US pint', '0.473176473'),
    u('cup', 'US cup', '0.2365882365'), u('fl oz', 'US fluid ounce', '0.0295735295625'), u('tbsp', 'Tablespoon', '0.01478676478125'),
    u('tsp', 'Teaspoon', '0.00492892159375'), u('gal (UK)', 'UK gallon', '4.54609'), u('ft³', 'Cubic foot', '28.316846592'),
    u('in³', 'Cubic inch', '0.016387064'),
  ],
  Data: [
    u('bit', 'Bit', '0.125'), u('B', 'Byte', '1'), u('kB', 'Kilobyte', '1000'), u('MB', 'Megabyte', '1000000'),
    u('GB', 'Gigabyte', '1000000000'), u('TB', 'Terabyte', '1000000000000'), u('KiB', 'Kibibyte', '1024'),
    u('MiB', 'Mebibyte', '1048576'), u('GiB', 'Gibibyte', '1073741824'), u('TiB', 'Tebibyte', '1099511627776'),
  ],
  Time: [
    u('ns', 'Nanosecond', '0.000000001'), u('µs', 'Microsecond', '0.000001'), u('ms', 'Millisecond', '0.001'), u('s', 'Second', '1'),
    u('min', 'Minute', '60'), u('h', 'Hour', '3600'), u('day', 'Day', '86400'), u('week', 'Week', '604800'),
    u('year', 'Year (365.25 days)', '31557600'),
  ],
  Speed: [
    u('m/s', 'Metre per second', '1'), u('km/h', 'Kilometre per hour', '1000/3600'), u('mph', 'Mile per hour', '1609.344/3600'),
    u('knot', 'Knot', '1852/3600'), u('ft/s', 'Foot per second', '0.3048'),
  ],
};

const big = (x: string | number) => math.bignumber(x);

function unit(category: Category, id: string): Unit {
  const found = UNITS[category].find((x) => x.id === id);
  if (!found) throw new Error(`unknown unit ${id} in ${category}`);
  return found;
}

/** [numerator, denominator] of a unit's factor. */
function ratio(factor: string): [BigNumber, BigNumber] {
  const [n, d = '1'] = factor.split('/');
  return [big(n), big(d)];
}

/** How many `to` units one `from` unit is, as an exact fraction. */
function factorBetween(category: Category, from: string, to: string): [BigNumber, BigNumber] {
  const [fn, fd] = ratio(unit(category, from).factor!);
  const [tn, td] = ratio(unit(category, to).factor!);
  return [fn.times(td), fd.times(tn)];
}

// Temperature formulas, {v} is the value; they are also shown as the working.
const FORMULAS: Record<string, string> = {
  '°C>°F': '{v} × 9 ÷ 5 + 32', '°F>°C': '({v} − 32) × 5 ÷ 9', '°C>K': '{v} + 273.15', 'K>°C': '{v} − 273.15',
  '°F>K': '({v} − 32) × 5 ÷ 9 + 273.15', 'K>°F': '({v} − 273.15) × 9 ÷ 5 + 32',
};

const evaluate = (expression: string) => math.evaluate(expression.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')) as BigNumber;
const fill = (template: string, value: string) => template.replace('{v}', value.startsWith('-') ? `(${value})` : value);

/** Converts an exact decimal value; the result is an exact decimal string (64 significant digits). */
export function convert(value: string, category: Category, from: string, to: string): string {
  if (from === to) return big(value).toString();
  if (category === 'Temperature') return evaluate(fill(FORMULAS[`${from}>${to}`], value)).toString();
  const [n, d] = factorBetween(category, from, to);
  return big(value).times(n).div(d).toString();
}

const show = (x: BigNumber | string) => formatNumber(x.toString()).replace(/^-/, '−');
const shown = (x: string) => (x.startsWith('-') ? `(${show(x)})` : show(x));
const PLAIN = /^\d+(\.\d+)?$/;

/** A decimal with at most 15 significant digits, or null when it repeats (1/3.6 = 0.2777…). */
function shortDecimal(n: BigNumber, d: BigNumber): BigNumber | null {
  const value = n.div(d).toSignificantDigits(15);
  return value.times(d).eq(n) ? value : null;
}

/** School working for a conversion: the factor (or the temperature formula), then the arithmetic. */
export function conversionWorking(value: string, category: Category, from: string, to: string): Working | null {
  if (from === to) return null;
  const start = `${show(value)} ${from}`;
  const result = convert(value, category, from, to);

  if (category === 'Temperature') {
    const template = FORMULAS[`${from}>${to}`];
    const expression = fill(template, value);
    const formula = `${to} = ${template.replace('{v}', from).replace(/ × 9 ÷ 5/, ' × 9/5').replace(/ × 5 ÷ 9/, ' × 5/9')}`;
    const steps: BreakdownStep[] = [{ line: `= ${expression.replace(/-(?=\d)/g, '−')} ${to}`, op: formula, detail: null }];
    const arithmetic = workingFor(expression);
    if (arithmetic?.kind === 'breakdown') steps.push(...arithmetic.steps.map((s) => ({ ...s, line: `${s.line} ${to}` })));
    else steps.push({ line: `= ${show(result)} ${to}`, op: `${expression} = ${show(result)}`, detail: arithmetic?.kind === 'grid' ? arithmetic.grid : null });
    return { kind: 'breakdown', start, steps };
  }

  const [n, d] = factorBetween(category, from, to);
  const times = shortDecimal(n, d);
  const per = times ? null : shortDecimal(d, n);
  const [sign, factor, factorText] = times
    ? ['×', times, `1 ${from} = ${show(times)} ${to}`]
    : per
      ? ['÷', per, `1 ${to} = ${show(per)} ${from}`]
      : ['×', n.div(d), `1 ${from} ≈ ${show(n.div(d))} ${to}`];
  const sum = `${shown(value)} ${sign} ${show(factor)}`;
  const plain = PLAIN.test(value) && PLAIN.test(factor.toFixed());
  return {
    kind: 'breakdown',
    start,
    steps: [
      { line: `= ${sum} ${to}`, op: factorText, detail: null },
      { line: `= ${show(result)} ${to}`, op: `${sum} = ${show(result)}`, detail: plain ? stepsFor(`${value} ${sign} ${factor.toFixed()}`) : null },
    ],
  };
}
