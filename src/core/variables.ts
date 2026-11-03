import { calculate, type CalcOptions } from './engine';

export interface ResolvedValues {
  /** Exact values for the boxes that work out. */
  vars: Record<string, string>;
  empty: string[];
  bad: string[];
}

/** Works out each letter's value box (a number or an expression like π/2); letters inside a box are not allowed. */
export function resolveValues(letters: readonly string[], texts: Readonly<Record<string, string>>, ans: string, options: CalcOptions): ResolvedValues {
  const result: ResolvedValues = { vars: {}, empty: [], bad: [] };
  for (const letter of letters) {
    const text = texts[letter]?.trim() ?? '';
    if (!text) {
      result.empty.push(letter);
      continue;
    }
    const value = calculate(text, ans, { angle: options.angle });
    if (value.ok) result.vars[letter] = value.exact;
    else result.bad.push(letter);
  }
  return result;
}
