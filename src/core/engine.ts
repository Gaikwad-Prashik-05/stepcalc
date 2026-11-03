import type { BigNumber, MathNode } from 'mathjs';
import { formatNumber } from './format';
import { math } from './math';

export type CalcError = 'empty' | 'divide-by-zero' | 'invalid' | 'too-large';

export type CalcResult =
  | { ok: true; exact: string; display: string }
  | { ok: false; error: CalcError };

export const ERROR_MESSAGES: Record<CalcError, string> = {
  empty: '',
  'divide-by-zero': "Can't divide by 0",
  invalid: 'Invalid format',
  'too-large': 'Number too large',
};

const MAX_LENGTH = 1000;
// Basic mode only: numbers, + − × ÷ ^ %, brackets and Ans. Anything else (assignments,
// functions, strings, matrices, other symbols) is rejected before evaluation.
const ALLOWED_NODES = new Set(['ConstantNode', 'OperatorNode', 'ParenthesisNode', 'SymbolNode']);

export function normalise(expression: string): string {
  return expression
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/[−–]/g, '-')
    .replace(/\bans\b/gi, 'Ans')
    // phone-style: a number right after % multiplies ("7%3" = 7% × 3), never remainder
    .replace(/%\s*(?=[\d.(A])/g, '%*');
}

function isAllowed(node: MathNode): boolean {
  let allowed = true;
  node.traverse((child) => {
    if (!ALLOWED_NODES.has(child.type)) allowed = false;
    else if (child.type === 'SymbolNode' && (child as unknown as { name: string }).name !== 'Ans') allowed = false;
    else if (child.type === 'ConstantNode' && typeof (child as unknown as { value: unknown }).value === 'string') allowed = false;
  });
  return allowed;
}

function dividesByZero(node: MathNode, scope: Record<string, BigNumber>): boolean {
  let found = false;
  node.traverse((child) => {
    const op = child as unknown as { type: string; fn?: string; args?: MathNode[] };
    if (found || op.type !== 'OperatorNode' || op.fn !== 'divide' || !op.args) return;
    const divisor = op.args[1].evaluate(scope);
    if (math.isBigNumber(divisor) && divisor.isZero()) found = true;
  });
  return found;
}

export function calculate(expression: string, ans = '0'): CalcResult {
  if (!expression.trim()) return { ok: false, error: 'empty' };
  if (expression.length > MAX_LENGTH) return { ok: false, error: 'invalid' };

  try {
    const node = math.parse(normalise(expression));
    if (!isAllowed(node)) return { ok: false, error: 'invalid' };

    const scope = { Ans: math.bignumber(ans) };
    if (dividesByZero(node, scope)) return { ok: false, error: 'divide-by-zero' };

    const value: unknown = node.evaluate(scope);
    if (!math.isBigNumber(value)) return { ok: false, error: 'invalid' };
    if (value.isNaN()) return { ok: false, error: 'invalid' };
    if (!value.isFinite()) return { ok: false, error: 'too-large' };

    const exact = value.toString();
    return { ok: true, exact, display: formatNumber(exact) };
  } catch {
    return { ok: false, error: 'invalid' };
  }
}
