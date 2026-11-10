import type { BigNumber, MathNode } from 'mathjs';
import { formatNumber } from './format';
import { DivideByZero, E, FUNCTION_NAMES, functionScope, MathError, PI, type AngleUnit } from './functions';
import { integrate } from './integral';
import { math } from './math';

export type CalcError =
  | 'empty' | 'divide-by-zero' | 'invalid' | 'too-large' | 'math-error' | 'missing-value'
  | 'solve-one-unknown' | 'no-solution' | 'solve-too-slow';

export type CalcResult =
  | { ok: true; exact: string; display: string }
  | { ok: false; error: CalcError };

export interface CalcOptions {
  angle?: AngleUnit;
  /** Values for letters in the expression, as exact decimal strings. */
  vars?: Record<string, string>;
}

export const ERROR_MESSAGES: Record<CalcError, string> = {
  empty: '',
  'divide-by-zero': "Can't divide by 0",
  invalid: 'Invalid format',
  'too-large': 'Number too large',
  'math-error': 'Math error',
  'missing-value': 'Enter a value for every letter',
  'solve-one-unknown': 'Leave exactly one letter empty to solve for it',
  'no-solution': 'No solution found',
  'solve-too-slow': 'Too complex to solve here',
};

export const MAX_LENGTH = 1000;
const ALLOWED_NODES = new Set(['ConstantNode', 'OperatorNode', 'ParenthesisNode', 'SymbolNode', 'FunctionNode']);
const ALLOWED_OPERATORS = new Set(['add', 'subtract', 'multiply', 'divide', 'pow', 'unaryMinus', 'unaryPlus']);
const CONSTANTS = new Set(['Ans', 'pi', 'e']);
/** Letters that can be variables: single a–z, except e (the constant). */
export const VARIABLE = /^[a-df-z]$/;

export function normalise(expression: string): string {
  return expression
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/[−–]/g, '-')
    // Python habit: 4**0.5
    .replace(/\*\*/g, '^')
    .replace(/\bans\b/gi, 'Ans')
    // The e key types ℯ: always the constant, so 2ℯ3 is 2×e×3 and 2ℯ+3 is never read as 2e+3 (2000).
    .replace(/(?<=[\d.)πℯ])ℯ/g, '*ℯ')
    .replace(/([πℯ])(?=[\d.(πℯ√∛a-zA-Z])/g, '$1*')
    .replace(/ℯ/g, 'e')
    .replace(/π/g, 'pi')
    .replace(/(sin|cos|tan)⁻¹/g, 'a$1')
    .replace(/ⁿ√/g, 'root')
    .replace(/∫/g, 'integrate')
    .replace(/ⁿ/g, '^n')
    // √16 without brackets, like on a Casio
    .replace(/([√∛])(\d+(?:\.\d+)?|[a-zπ])/gi, '$1($2)')
    .replace(/∛/g, 'cbrt')
    .replace(/√/g, 'sqrt')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/[A-Za-z]+/g, splitLetters);
}

/** Function and constant names that letter-splitting must leave alone. */
const KNOWN_NAMES = new Set([...FUNCTION_NAMES, 'pi', 'e']);

/**
 * Letters written together multiply, like in maths: at → a*t, 2xy → 2x*y, x(2) → x*(2).
 * A longer unknown word right before a bracket is left as a (rejected) function name: sinh(1).
 */
function splitLetters(word: string, offset: number, text: string): string {
  if (KNOWN_NAMES.has(word) || !/^[a-z]+$/.test(word)) return word;
  const beforeBracket = /^\s*\(/.test(text.slice(offset + word.length));
  if (beforeBracket && word.length > 2) return word;
  return word.split('').join('*') + (beforeBracket ? '*' : '');
}

type Parent = MathNode | null;
type Call = MathNode & { fn: { name?: string }; args: MathNode[] };

/** `∫(f, a, b)`: f is in terms of x, which belongs to the integral and never needs a value. */
export const isIntegral = (node: MathNode): node is Call => node.type === 'FunctionNode' && (node as Call).fn.name === 'integrate';
const BOUND = 'x';

/** Basic + scientific: numbers, operators, brackets, known functions, Ans/π/e and the given letters. */
function isAllowed(node: MathNode, letters: ReadonlySet<string>): boolean {
  let allowed = true;
  node.traverse((child, path, parent: Parent) => {
    const n = child as unknown as { type: string; name?: string; fn?: string | MathNode; value?: unknown };
    if (!ALLOWED_NODES.has(n.type)) allowed = false;
    else if (n.type === 'OperatorNode' && !ALLOWED_OPERATORS.has(n.fn as string)) allowed = false;
    else if (n.type === 'FunctionNode' && !FUNCTION_NAMES.has((n.fn as unknown as { name?: string }).name ?? '')) allowed = false;
    else if (n.type === 'SymbolNode') {
      const isFunctionName = parent?.type === 'FunctionNode' && path === 'fn';
      if (!isFunctionName && !CONSTANTS.has(n.name!) && !letters.has(n.name!)) allowed = false;
    } else if (n.type === 'ConstantNode' && typeof n.value === 'string') allowed = false;
  });
  return allowed;
}

/**
 * `5!` → `fact(5)` and `7%3` → `mod(7, 3)`, so neither needs extra mathjs code.
 * A number after % makes it remainder, floored like Python (-10%3 = 2); otherwise % is percent (50+10%).
 */
const AS_FUNCTION: Record<string, string> = { factorial: 'fact', mod: 'mod' };
function rewriteOperators(node: MathNode): MathNode {
  return node.transform((n) => {
    const op = n as unknown as { type: string; fn?: string; args?: MathNode[] };
    if (op.type === 'OperatorNode' && op.fn! in AS_FUNCTION) {
      return new math.FunctionNode(new math.SymbolNode(AS_FUNCTION[op.fn!]), op.args!.map(rewriteOperators));
    }
    return n;
  });
}

/** Parses and checks an expression; throws on anything the calculator does not support. */
export function parseExpression(expression: string, letters: ReadonlySet<string> = new Set()): MathNode {
  const node = rewriteOperators(math.parse(normalise(expression)));
  const integrals = node.filter(isIntegral) as Call[];
  if (integrals.some((call) => call.args.length !== 3)) throw new Error('integral needs ∫(f, from, to)');
  if (!isAllowed(node, integrals.length ? new Set([...letters, BOUND]) : letters)) throw new Error('not allowed');
  return node;
}

/** Single letters used as variables in an expression (sorted), or [] if it does not parse. */
export function lettersIn(expression: string): string[] {
  try {
    const found = new Set<string>();
    // forEach skips a function's own name, so sin is never taken for letters.
    const visit = (n: MathNode, bound: boolean): void => {
      if (isIntegral(n)) return n.args.forEach((arg, i) => visit(arg, bound || i === 0));
      const name = (n as unknown as { name?: string }).name;
      if (n.type === 'SymbolNode' && name && VARIABLE.test(name) && !(bound && name === BOUND)) found.add(name);
      n.forEach((child) => visit(child, bound));
    };
    visit(math.parse(normalise(expression.split('=').join('+'))), false);
    return [...found].sort();
  } catch {
    return [];
  }
}

export function evaluationScope(ans: string, options: CalcOptions): Record<string, unknown> {
  const vars = Object.fromEntries(Object.entries(options.vars ?? {}).map(([k, v]) => [k, math.bignumber(v)]));
  return { ...functionScope(options.angle ?? 'deg'), ...vars, Ans: math.bignumber(ans), pi: PI, e: E };
}

function dividesByZero(node: MathNode, scope: Record<string, unknown>): boolean {
  let found = false;
  node.traverse((child) => {
    const op = child as unknown as { type: string; fn?: string; args?: MathNode[] };
    if (found || op.type !== 'OperatorNode' || op.fn !== 'divide' || !op.args) return;
    try {
      const divisor = op.args[1].evaluate(scope);
      if (math.isBigNumber(divisor) && divisor.isZero()) found = true;
    } catch {
      // A math error inside the divisor is reported by the full evaluation.
    }
  });
  return found;
}

/** Each ∫(f, a, b) replaced by its value. */
function resolveIntegrals(node: MathNode, scope: Record<string, unknown>): MathNode {
  return node.transform((n) => {
    if (!isIntegral(n)) return n;
    const [f, a, b] = n.args;
    return new math.ConstantNode(integrate(f, resolveIntegrals(a, scope).evaluate(scope), resolveIntegrals(b, scope).evaluate(scope), scope));
  });
}

/** Evaluates an already-parsed node; errors become CalcResult errors. */
export function evaluateNode(parsed: MathNode, scope: Record<string, unknown>): CalcResult {
  try {
    const node = resolveIntegrals(parsed, scope);
    if (dividesByZero(node, scope)) return { ok: false, error: 'divide-by-zero' };
    const value: unknown = node.evaluate(scope);
    if (!math.isBigNumber(value)) return { ok: false, error: 'invalid' };
    if (value.isNaN()) return { ok: false, error: 'math-error' };
    if (!value.isFinite()) return { ok: false, error: 'too-large' };
    const exact = (value as BigNumber).toString();
    return { ok: true, exact, display: formatNumber(exact) };
  } catch (error) {
    if (error instanceof MathError) return { ok: false, error: 'math-error' };
    if (error instanceof DivideByZero) return { ok: false, error: 'divide-by-zero' };
    return { ok: false, error: 'invalid' };
  }
}

export function calculate(expression: string, ans = '0', options: CalcOptions = {}): CalcResult {
  if (!expression.trim()) return { ok: false, error: 'empty' };
  if (expression.length > MAX_LENGTH) return { ok: false, error: 'invalid' };

  const letters = new Set(lettersIn(expression));
  let node: MathNode;
  try {
    node = parseExpression(expression, letters);
  } catch {
    return { ok: false, error: 'invalid' };
  }
  if ([...letters].some((l) => options.vars?.[l] === undefined)) return { ok: false, error: 'missing-value' };
  return evaluateNode(node, evaluationScope(ans, options));
}
