import { describe, expect, it } from 'vitest';
import { formatNumber } from './format';
import { CATEGORIES, convert, conversionWorking, UNITS } from './units';

const c = (value: string, category: (typeof CATEGORIES)[number], from: string, to: string) => formatNumber(convert(value, category, from, to));

describe('convert: exact factors', () => {
  it.each([
    ['5', 'Length', 'km', 'm', '5,000'], ['1', 'Length', 'mi', 'm', '1,609.344'], ['1', 'Length', 'in', 'cm', '2.54'],
    ['12', 'Length', 'in', 'ft', '1'], ['1', 'Length', 'nmi', 'km', '1.852'], ['1', 'Length', 'm', 'ft', '3.28083989501'],
    ['1', 'Mass', 'lb', 'kg', '0.45359237'], ['16', 'Mass', 'oz', 'lb', '1'], ['1', 'Mass', 'st', 'lb', '14'], ['2.5', 'Mass', 't', 'kg', '2,500'],
    ['1', 'Area', 'ha', 'm²', '10,000'], ['1', 'Area', 'acre', 'ft²', '43,560'], ['1', 'Area', 'mi²', 'acre', '640'],
    ['1', 'Volume', 'gal', 'L', '3.785411784'], ['1', 'Volume', 'gal', 'qt', '4'], ['1', 'Volume', 'cup', 'tbsp', '16'], ['1', 'Volume', 'm³', 'L', '1,000'],
    ['1', 'Volume', 'gal (UK)', 'L', '4.54609'],
    ['1', 'Data', 'GB', 'MB', '1,000'], ['1', 'Data', 'GiB', 'MiB', '1,024'], ['1', 'Data', 'B', 'bit', '8'], ['1', 'Data', 'TB', 'GiB', '931.322574615'],
    ['1', 'Time', 'h', 's', '3,600'], ['1', 'Time', 'week', 'h', '168'], ['1', 'Time', 'year', 'day', '365.25'],
    ['36', 'Speed', 'km/h', 'm/s', '10'], ['1', 'Speed', 'mph', 'km/h', '1.609344'], ['1', 'Speed', 'knot', 'km/h', '1.852'], ['10', 'Speed', 'm/s', 'km/h', '36'],
  ] as const)('%s %s → %s', (v, cat, from, to, expected) => {
    expect(c(v, cat, from, to)).toBe(expected);
  });

  it('round-trips every pair', () => {
    for (const category of CATEGORIES) {
      for (const a of UNITS[category]) {
        for (const b of UNITS[category]) {
          const back = convert(convert('7.25', category, a.id, b.id), category, b.id, a.id);
          expect(formatNumber(back), `${category} ${a.id}→${b.id}`).toBe('7.25');
        }
      }
    }
  });
});

describe('convert: temperature', () => {
  it.each([
    ['100', '°C', '°F', '212'], ['32', '°F', '°C', '0'], ['0', '°C', 'K', '273.15'], ['-40', '°C', '°F', '-40'],
    ['0', 'K', '°F', '-459.67'], ['98.6', '°F', '°C', '37'], ['300', 'K', '°C', '26.85'],
  ])('%s %s → %s', (v, from, to, expected) => {
    expect(c(v, 'Temperature', from, to)).toBe(expected);
  });
});

describe('conversionWorking', () => {
  it('multiplies by the factor, with column working', () => {
    const w = conversionWorking('5', 'Length', 'km', 'm');
    expect(w?.kind).toBe('breakdown');
    if (w?.kind !== 'breakdown') return;
    expect(w.start).toBe('5 km');
    expect(w.steps.map((s) => s.line)).toEqual(['= 5 × 1,000 m', '= 5,000 m']);
    expect(w.steps.map((s) => s.op)).toEqual(['1 km = 1,000 m', '5 × 1,000 = 5,000']);
    expect(w.steps[1].detail).not.toBeNull();
  });

  it('divides when the factor is a repeating decimal', () => {
    const w = conversionWorking('36', 'Speed', 'km/h', 'm/s');
    if (w?.kind !== 'breakdown') throw new Error('no breakdown');
    expect(w.steps.map((s) => s.line)).toEqual(['= 36 ÷ 3.6 m/s', '= 10 m/s']);
    expect(w.steps[0].op).toBe('1 m/s = 3.6 km/h');
  });

  it('shows the temperature formula', () => {
    const w = conversionWorking('100', 'Temperature', '°C', '°F');
    if (w?.kind !== 'breakdown') throw new Error('no breakdown');
    expect(w.start).toBe('100 °C');
    expect(w.steps[0].op).toBe('°F = °C × 9/5 + 32');
    expect(w.steps.at(-1)?.line).toBe('= 212 °F');
  });

  it('has nothing to show for the same unit', () => {
    expect(conversionWorking('5', 'Length', 'm', 'm')).toBeNull();
  });
});
