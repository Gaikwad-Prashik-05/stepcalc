import { describe, expect, it } from 'vitest';
import { stepsFor, type GridWork } from './steps-grid';
import { divisionWork, multiplicationWork } from './steps-muldiv';

const row = (w: GridWork, i: number) => w.lines[i].cells.join('');

describe('multiplicationWork', () => {
  it('one-digit multiplier carries column by column', () => {
    const w = multiplicationWork('478 × 6')!;
    expect(w.lines[0].cells).toEqual(['', '4', '4', '']);
    expect(row(w, 1)).toBe('478');
    expect(row(w, 3)).toBe('2868');
    expect(w.notes).toEqual([
      'Ones: 8 × 6 = 48, write 8 carry 4',
      'Tens: 7 × 6 + 4 = 46, write 6 carry 4',
      'Hundreds: 4 × 6 + 4 = 28, write 28',
    ]);
  });

  it('long multiplication writes one row per digit, then adds', () => {
    const w = multiplicationWork('478*56')!;
    expect(w.lines.map((l) => l.cells.join(''))).toEqual(['478', '56', '2868', '23900', '26768']);
    expect(w.lines[3].gutter).toBe('+');
    expect(w.notes).toEqual([
      '478 × 6 (ones digit) = 2868 → 2868',
      '478 × 5 (tens digit) = 2390, shifted 1 place left (write 1 zero) → 23900',
      'Add the rows: 2868 + 23900 = 26768',
    ]);
  });

  it('decimals: multiply whole numbers then put the point back', () => {
    const w = multiplicationWork('2.5 × 1.2')!;
    expect(w.notes[0]).toBe('Ignore the points for now: 25 × 12.');
    expect(w.notes.at(-1)).toBe('2.5 has 1 decimal place and 1.2 has 1, so put the point 2 places from the right: 3.00');
    expect(w.lines.at(-1)!.text).toBe('= 3.00');
    expect(multiplicationWork('0.5 × 0.5')!.lines.at(-1)!.text).toBe('= 0.25');
  });

  it.each(['2+3', '2×3×4', '2×-3', `2×${'1'.repeat(7)}`])('no working for %s', (e) => {
    expect(multiplicationWork(e)).toBeNull();
  });
});

describe('divisionWork', () => {
  it('480 ÷ 4 matches the paper layout', () => {
    const w = divisionWork('480 ÷ 4')!;
    expect(w.lines.map((l) => l.cells.join(''))).toEqual(['120', '480', '4', '08', '8', '00', '0', '0']);
    expect(w.lines[1].gutter).toBe('4');
    expect(w.notes).toEqual([
      '4 goes into 4 1 time: 1 × 4 = 4, 4 − 4 = 0',
      'Bring down 8 → 8. 4 goes into 8 2 times: 2 × 4 = 8, 8 − 8 = 0',
      'Bring down 0 → 0. 4 goes into 0 0 times: 0 × 4 = 0, 0 − 0 = 0',
      'Remainder 0, so 480 ÷ 4 = 120',
    ]);
  });

  it('60 ÷ 4 = 15 takes two digits first (the corrected paper sample)', () => {
    const w = divisionWork('60/4')!;
    expect(w.lines[0].cells).toEqual(['1', '5']);
    expect(w.notes.at(-1)).toBe('Remainder 0, so 60 ÷ 4 = 15');
    expect(divisionWork('15 ÷ 4')!.lines[0].cells).toEqual(['', '3', '7', '5']);
  });

  it('carries on past the point with zeros', () => {
    const w = divisionWork('15 ÷ 4')!;
    expect(w.pointBefore).toBe(2);
    expect(w.notes).toContain('No digits left but remainder 3: put a point in the answer and bring down zeros.');
    expect(w.notes.at(-1)).toBe('Remainder 0, so 15 ÷ 4 = 3.75');
  });

  it('stops when a remainder repeats', () => {
    const w = divisionWork('1 ÷ 3')!;
    expect(w.notes.at(-1)).toBe('Remainder 1 came back, so the digits 3 repeat forever.');
    expect(w.lines[0].cells.join('')).toBe('03');
  });

  it('stops after 6 decimals when the cycle is long', () => {
    const w = divisionWork('1 ÷ 17')!;
    expect(w.notes.at(-1)).toBe('Stopped after 6 decimal places; the answer keeps going.');
    expect(w.lines[0].cells.join('')).toBe('0058823');
  });

  it('makes a decimal divisor whole first', () => {
    const w = divisionWork('7.5 ÷ 0.25')!;
    expect(w.notes[0]).toBe('Make the divisor whole: multiply both numbers by 100 → 750 ÷ 25');
    expect(w.lines[1].gutter).toBe('25');
    expect(w.notes.at(-1)).toBe('Remainder 0, so 7.5 ÷ 0.25 = 30');
  });

  it.each(['1 ÷ 0', '6 ÷ 2 ÷ 3', '2 × 3'])('no working for %s', (e) => {
    expect(divisionWork(e)).toBeNull();
  });
});

describe('stepsFor agrees with the engine (working is self-checked)', () => {
  const rand = (seed: { s: number }) => (seed.s = (seed.s * 16807) % 2147483647) / 2147483647;
  const num = (r: () => number, maxInt: number) => {
    const int = String(Math.floor(r() * 10 ** (1 + Math.floor(r() * maxInt))));
    return r() < 0.3 ? `${int}.${String(Math.floor(r() * 100) + 1)}` : int;
  };

  it('for 2000 random multiplications and divisions', () => {
    const seed = { s: 7 };
    const r = () => rand(seed);
    for (let i = 0; i < 2000; i++) {
      const mul = r() < 0.5;
      const b = num(r, mul ? 4 : 3);
      if (!mul && Number(b) === 0) continue;
      const expr = `${num(r, 6)} ${mul ? '×' : '÷'} ${b}`;
      expect(stepsFor(expr), expr).not.toBeNull();
    }
  });

  it('still covers addition and subtraction', () => {
    expect(stepsFor('37270 − 11359')!.label).toBe('Column subtraction: 37270 minus 11359 equals 25911');
    expect(stepsFor('2 ^ 3')).toBeNull();
  });
});
