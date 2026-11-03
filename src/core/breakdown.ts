import type { BigNumber, MathNode } from 'mathjs';
import { calculate, normalise } from './engine';
import { formatNumber } from './format';
import { math } from './math';
import { stepsFor, type GridWork } from './steps-grid';

export interface BreakdownStep {
  /** The whole expression after this step, e.g. "= 5 + 6". */
  line: string;
  /** The one operation done in this step, e.g. "3 × 2 = 6". */
  op: string;
  /** Column / long-division working for that operation, when there is one. */
  detail: GridWork | null;
}

export type Working =
  | { kind: 'grid'; grid: GridWork }
  | { kind: 'breakdown'; start: string; steps: BreakdownStep[] };

const MAX_STEPS = 25;
const SYMBOLS: Record<string, string> = { add: '+', subtract: '−', multiply: '×', divide: '÷', pow: '^' };
// BODMAS: orders, then × ÷, then + −.
const PRIORITY: Record<string, number> = { pow: 3, multiply: 2, divide: 2, add: 1, subtract: 1 };
const PLAIN = /^\d+(\.\d+)?$/;

type Op = MathNode & { fn: string; args: MathNode[] };
type Constant = MathNode & { value: BigNumber };

const unwrap = (node: MathNode): MathNode =>
  node.type === 'ParenthesisNode' ? unwrap((node as unknown as { content: MathNode }).content) : node;
const isConstant = (node: MathNode): node is Constant => unwrap(node).type === 'ConstantNode';
const valueOf = (node: MathNode) => (unwrap(node) as Constant).value;
const constant = (value: BigNumber): MathNode => new math.ConstantNode(value);

/** Folds things that are not steps: brackets round a single number, and −number. */
function tidy(node: MathNode): MathNode {
  return node.transform((n) => {
    if (n.type === 'ParenthesisNode' && isConstant(n)) return unwrap(n);
    const op = n as Op;
    if (n.type === 'OperatorNode' && op.args.length === 1 && isConstant(op.args[0])) {
      if (op.fn === 'unaryMinus') return constant(valueOf(op.args[0]).neg());
      if (op.fn === 'unaryPlus') return unwrap(op.args[0]);
    }
    return n;
  });
}

/** Next operation to do: deepest brackets first, then BODMAS priority, then leftmost. */
function nextOperation(root: MathNode): Op | null {
  let best: { node: Op; depth: number; priority: number } | null = null;
  const visit = (node: MathNode, depth: number) => {
    if (node.type === 'ParenthesisNode') return visit((node as unknown as { content: MathNode }).content, depth + 1);
    if (node.type !== 'OperatorNode') return;
    const op = node as Op;
    if (op.args.length === 2 && op.args.every(isConstant) && PRIORITY[op.fn]) {
      const priority = PRIORITY[op.fn];
      if (!best || depth > best.depth || (depth === best.depth && priority > best.priority)) best = { node: op, depth, priority };
      return;
    }
    op.args.forEach((arg) => visit(arg, depth));
  };
  visit(root, 0);
  return (best as { node: Op } | null)?.node ?? null;
}

const show = (value: BigNumber) => formatNumber(value.toString()).replace(/-/g, '−');

function print(root: MathNode): string {
  if (isConstant(root)) return show(valueOf(root));
  const text = root.toString({
    parenthesis: 'keep',
    implicit: 'show',
    handler: (node: MathNode) => {
      if (node.type !== 'ConstantNode') return undefined;
      const value = (node as Constant).value;
      return value.isNegative() ? `(${show(value)})` : show(value);
    },
  });
  return text.replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−');
}

function detailFor(fn: string, a: BigNumber, b: BigNumber): GridWork | null {
  const [x, y] = [a.toString(), b.toString()];
  if (fn === 'pow' || !PLAIN.test(x) || !PLAIN.test(y)) return null;
  return stepsFor(`${x} ${SYMBOLS[fn]} ${y}`);
}

/**
 * School working for an expression: a BODMAS breakdown one operation at a time, or for a single
 * operation straight to its column / long-division working. Null when there is nothing to show.
 */
export function workingFor(expression: string, ans = '0'): Working | null {
  const engine = calculate(expression, ans);
  // % is rewritten by mathjs into a different tree, so it gets no breakdown (yet).
  if (!engine.ok || expression.includes('%')) return null;

  let tree: MathNode;
  try {
    tree = math.parse(normalise(expression)).transform((n) =>
      n.type === 'SymbolNode' ? constant(math.bignumber(ans)) : n, // the engine only allows the Ans symbol
    );
  } catch {
    return null;
  }
  tree = tidy(tree);
  const start = print(tree);

  const steps: BreakdownStep[] = [];
  for (let next = nextOperation(tree); next; next = nextOperation(tree)) {
    if (steps.length >= MAX_STEPS) return null;
    const target = next;
    const [a, b] = target.args.map(valueOf);
    const value = target.evaluate() as BigNumber;
    if (!math.isBigNumber(value) || !value.isFinite()) return null;
    tree = tidy(tree.transform((n) => (n === target ? constant(value) : n)));
    steps.push({
      line: `= ${print(tree)}`,
      op: `${show(a)} ${SYMBOLS[target.fn]} ${show(b)} = ${show(value)}`,
      detail: detailFor(target.fn, a, b),
    });
  }

  // Safety net: the breakdown must land on the engine's exact answer.
  if (!steps.length || !isConstant(tree) || !valueOf(tree).eq(math.bignumber(engine.exact))) return null;
  if (steps.length === 1) return steps[0].detail ? { kind: 'grid', grid: steps[0].detail } : null;
  return { kind: 'breakdown', start, steps };
}
