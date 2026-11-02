// shortcut: integer "a + b" only, to prove core -> ui wiring; replaced by the mathjs engine in Feature 2.
export function evaluate(expression: string): string {
  const match = /^\s*(-?\d+)\s*\+\s*(-?\d+)\s*$/.exec(expression);
  if (!match) throw new Error(`Unsupported expression: ${expression}`);
  return String(Number(match[1]) + Number(match[2]));
}
