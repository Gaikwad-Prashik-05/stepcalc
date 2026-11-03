import { describe, expect, it } from 'vitest';
import { readDrawing } from './layout';
import { PointCloudRecognizer, type Stroke } from './recognizer';
import { GLYPHS } from './templates';
import { BUILT_IN_TEMPLATES } from './templates';

const recognizer = new PointCloudRecognizer(BUILT_IN_TEMPLATES);

/** A glyph (first variant) drawn with its top-left at (x, y), `size` tall. */
const at = (label: string, x: number, y: number, size: number, variant = 0): Stroke[] =>
  GLYPHS[label][variant].map((s) => s.map((p) => ({ x: x + p.x * size, y: y + p.y * size })));
const line = (x1: number, y1: number, x2: number, y2: number): Stroke[] => [[{ x: x1, y: y1 }, { x: (x1 + x2) / 2, y: (y1 + y2) / 2 }, { x: x2, y: y2 }]];
const dot = (x: number, y: number): Stroke[] => [[{ x, y }, { x: x + 1, y: y + 1 }]];
const read = (...parts: Stroke[][]) => readDrawing(parts.flat(), recognizer).expression;

describe('readDrawing', () => {
  it('reads a sum left to right, whatever order it was drawn in', () => {
    expect(read(at('2', 0, 0, 60), at('+', 50, 15, 30), at('3', 100, 0, 60))).toBe('2+3');
    expect(read(at('3', 100, 0, 60), at('2', 0, 0, 60), at('+', 50, 15, 30))).toBe('2+3');
  });

  it('reads flat strokes as minus and equals, dots as a point', () => {
    expect(read(at('7', 0, 0, 60), line(50, 30, 80, 30), at('2', 100, 0, 60))).toBe('7−2');
    expect(read(at('1', 0, 0, 60), dot(40, 58), at('5', 60, 0, 60))).toBe('1.5');
    expect(read(at('4', 0, 0, 60), line(50, 22, 85, 22), line(50, 38, 85, 38), at('4', 100, 0, 60))).toBe('4=4');
    expect(read(at('8', 0, 0, 60), line(50, 30, 85, 30), dot(67, 15), dot(67, 45), at('2', 100, 0, 60))).toBe('8÷2');
  });

  it('reads a small raised symbol as a power', () => {
    expect(read(at('x', 0, 40, 60), at('2', 68, 5, 30))).toBe('x^(2)');
    expect(read(at('2', 0, 40, 60), at('3', 45, 5, 30), at('+', 90, 55, 30), at('1', 140, 40, 60))).toBe('2^(3)+1');
  });

  it('reads a fraction bar with numbers above and below', () => {
    expect(read(at('1', 25, 0, 50), line(0, 62, 80, 62), at('2', 25, 75, 50))).toBe('(1)÷(2)');
    expect(read(at('3', 0, 40, 50), at('+', 45, 50, 30), at('1', 105, 0, 50), line(85, 60, 150, 60), at('4', 105, 70, 50))).toBe('3+(1)÷(4)');
  });

  it('reads √ over what it covers', () => {
    expect(read(at('√', 0, 0, 80), at('9', 50, 12, 60))).toBe('√(9)');
  });

  it('turns letters that spell a function into the function, adding brackets', () => {
    expect(read(at('s', 0, 30, 40), at('i', 30, 30, 40), at('n', 50, 30, 40), at('3', 90, 10, 60), at('0', 130, 10, 60))).toBe('sin(30)');
    expect(read(at('l', 0, 10, 60), at('n', 25, 30, 40), at('2', 70, 10, 60))).toBe('ln(2)');
  });

  it('reads x as times between numbers, as a letter otherwise', () => {
    expect(read(at('2', 0, 0, 60), at('x', 50, 20, 30), at('3', 100, 0, 60))).toBe('2×3');
    expect(read(at('2', 0, 0, 60), at('x', 45, 20, 40), line(100, 40, 130, 40), at('1', 150, 0, 60), line(185, 32, 215, 32), line(185, 48, 215, 48), at('5', 235, 0, 60))).toBe('2x−1=5');
  });

  it('applies a tapped choice and offers alternatives', () => {
    const strokes = [at('2', 0, 0, 60), at('x', 50, 20, 30), at('3', 100, 0, 60)].flat();
    const first = readDrawing(strokes, recognizer);
    const times = first.tokens.find((t) => t.text === '×')!;
    expect(times.alternatives).toEqual(expect.arrayContaining(['×', 'x', '+']));
    const again = readDrawing(strokes, recognizer, new Map([[times.key!, '+']]));
    expect(again.expression).toBe('2+3');
  });

  it('lets a tapped function name go back to letters', () => {
    const strokes = [at('s', 0, 30, 40), at('i', 30, 30, 40), at('n', 50, 30, 40), at('x', 90, 30, 40)].flat();
    const fn = readDrawing(strokes, recognizer).tokens[0];
    expect(fn.text).toBe('sin');
    expect(readDrawing(strokes, recognizer, new Map([[fn.key!, 's·i·n']])).expression).toBe('sinx');
  });

  it('reads nothing as nothing', () => {
    expect(readDrawing([], recognizer).expression).toBe('');
  });
});

describe('readDrawing: cache', () => {
  it('re-reads a symbol whose dot/line status changes as more is drawn', () => {
    const cache = new Map<string, string[]>();
    const point = dot(10, 58);
    readDrawing(point, recognizer, new Map(), cache); // alone, a dot is not small next to anything
    const later = readDrawing([...point, ...at('5', 20, 0, 60)], recognizer, new Map(), cache);
    expect(later.expression).toBe('.5');
  });
});
