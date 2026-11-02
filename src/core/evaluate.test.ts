import { describe, expect, it } from 'vitest';
import { evaluate } from './evaluate';

describe('evaluate (placeholder until Feature 2)', () => {
  it('adds two integers', () => {
    expect(evaluate('1 + 1')).toBe('2');
  });

  it('rejects anything that is not "a + b"', () => {
    expect(() => evaluate('2 * 3')).toThrow();
  });
});
