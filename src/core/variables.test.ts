import { describe, expect, it } from 'vitest';
import { resolveValues } from './variables';

describe('resolveValues', () => {
  it('works out each box, including expressions', () => {
    const r = resolveValues(['x', 'y'], { x: '3', y: '1/2' }, '0', { angle: 'deg' });
    expect(r).toEqual({ vars: { x: '3', y: '0.5' }, empty: [], bad: [] });
  });

  it('uses the angle unit and Ans inside a box', () => {
    expect(resolveValues(['a'], { a: 'sin(30)' }, '0', { angle: 'deg' }).vars.a).toBe('0.5');
    expect(resolveValues(['a'], { a: 'Ans×2' }, '21', {}).vars.a).toBe('42');
  });

  it('separates empty boxes from bad ones', () => {
    const r = resolveValues(['a', 'b', 'c'], { a: '  ', b: '2+', c: '√(-1)' }, '0', {});
    expect(r.empty).toEqual(['a']);
    expect(r.bad).toEqual(['b', 'c']);
    expect(r.vars).toEqual({});
  });

  it('does not allow a letter inside a box', () => {
    expect(resolveValues(['a'], { a: '2x' }, '0', {}).bad).toEqual(['a']);
  });
});
