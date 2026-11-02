import { describe, expect, it } from 'vitest';
import { calculate } from './engine';
import { columnWork } from './steps';
import { math } from './math';

describe('columnWork: subtraction', () => {
  it('37270 − 11359 borrows like on paper', () => {
    const w = columnWork('37270 − 11359')!;
    expect(w.kind).toBe('sub');
    expect(w.rows).toEqual([['3', '7', '2', '7', '0'], ['1', '1', '3', '5', '9']]);
    expect(w.marks).toEqual(['', '6', '12', '6', '10']);
    expect(w.crossed).toEqual([false, true, true, true, true]);
    expect(w.result).toEqual(['2', '5', '9', '1', '1']);
    expect(w.negative).toBe(false);
    expect(w.notes).toEqual([
      'Ones: 0 < 9, borrow 1 → 10 − 9 = 1',
      'Tens: 6 − 5 = 1',
      'Hundreds: 2 < 3, borrow 1 → 12 − 3 = 9',
      'Thousands: 6 − 1 = 5',
      'Ten-thousands: 3 − 1 = 2',
    ]);
  });

  it('borrows across zeros (1000 − 1)', () => {
    const w = columnWork('1000-1')!;
    expect(w.marks).toEqual(['0', '9', '9', '10']);
    expect(w.result).toEqual(['', '9', '9', '9']);
    expect(w.notes[0]).toBe('Ones: 0 < 1, borrow 1 → 10 − 1 = 9');
    expect(w.notes[3]).toBe('Thousands: 0, nothing left to write');
  });

  it('smaller minus bigger swaps and goes negative', () => {
    const w = columnWork('5 − 12')!;
    expect(w.negative).toBe(true);
    expect(w.rows).toEqual([['1', '2'], ['', '5']]);
    expect(w.result).toEqual(['', '7']);
    expect(w.notes[0]).toBe('12 is bigger than 5, so work out 12 − 5 and make the answer negative.');
  });

  it('lines up decimals and pads with zeros', () => {
    const w = columnWork('5.2 - 1.75')!;
    expect(w.fractionDigits).toBe(2);
    expect(w.rows).toEqual([['5', '2', '0'], ['1', '7', '5']]);
    expect(w.result).toEqual(['3', '4', '5']);
    expect(w.notes[0]).toBe('Hundredths: 0 < 5, borrow 1 → 10 − 5 = 5');
  });
});

describe('columnWork: addition', () => {
  it('carries into the next column', () => {
    const w = columnWork('478 + 256')!;
    expect(w.kind).toBe('add');
    expect(w.marks).toEqual(['1', '1', '']);
    expect(w.result).toEqual(['7', '3', '4']);
    expect(w.notes).toEqual([
      'Ones: 8 + 6 = 14, write 4 carry 1',
      'Tens: 7 + 5 + 1 = 13, write 3 carry 1',
      'Hundreds: 4 + 2 + 1 = 7',
    ]);
  });

  it('final carry adds a new column', () => {
    const w = columnWork('99+1')!;
    expect(w.rows).toEqual([['', '9', '9'], ['', '', '1']]);
    expect(w.marks).toEqual(['1', '1', '']);
    expect(w.result).toEqual(['1', '0', '0']);
    expect(w.notes.at(-1)).toBe('Hundreds: carried 1, write 1');
  });

  it('adds several numbers with a carry bigger than 1', () => {
    const w = columnWork('9+9+9')!;
    expect(w.result).toEqual(['2', '7']);
    expect(w.notes[0]).toBe('Ones: 9 + 9 + 9 = 27, write 7 carry 2');
  });

  it('adds decimals', () => {
    expect(columnWork('0.1 + 0.2')!.result).toEqual(['0', '3']);
    expect(columnWork('.5 + 2')!.rows).toEqual([['0', '5'], ['2', '0']]);
  });
});

describe('columnWork: no working', () => {
  it.each(['', '5', '2*3', '5+3-2', '(1+2)', 'Ans+1', '10%+1', '-5+3', '1e5+1', '1,000+1', `${'9'.repeat(25)}+1`])('%s', (expr) => {
    expect(columnWork(expr)).toBeNull();
  });
});

describe('columnWork agrees with the engine', () => {
  const rand = (seed: { s: number }) => (seed.s = (seed.s * 16807) % 2147483647) / 2147483647;
  const num = (r: () => number) => {
    const int = String(Math.floor(r() * 10 ** Math.floor(r() * 9)));
    return r() < 0.4 ? `${int}.${String(Math.floor(r() * 10 ** (1 + Math.floor(r() * 4))))}` : int;
  };

  it('for 3000 random sums', () => {
    const seed = { s: 42 };
    const r = () => rand(seed);
    for (let i = 0; i < 3000; i++) {
      const parts = Array.from({ length: r() < 0.5 ? 2 : 2 + Math.floor(r() * 4) }, () => num(r));
      const expr = r() < 0.5 ? parts.join(' + ') : `${parts[0]} − ${parts[1]}`;
      const w = columnWork(expr);
      expect(w, expr).not.toBeNull();
      const engine = calculate(expr);
      if (!engine.ok) throw new Error(expr);
      const digits = w!.result.join('');
      const text = w!.fractionDigits ? `${digits.slice(0, -w!.fractionDigits)}.${digits.slice(-w!.fractionDigits)}` : digits;
      expect(math.bignumber(`${w!.negative ? '-' : ''}${text || '0'}`).eq(math.bignumber(engine.exact)), expr).toBe(true);
    }
  });
});
