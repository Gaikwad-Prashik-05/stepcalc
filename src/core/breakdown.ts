import type { BigNumber, MathNode } from 'mathjs';
import { calculate, evaluationScope, lettersIn, parseExpression, type CalcOptions } from './engine';
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
// A function call is worked out as soon as everything inside its brackets is a number.
const FUNCTION_PRIORITY = 4;
/** How function names are shown: the way the keys type them. */
const FUNCTION_LABELS: Record<string, string> = { asin: 'sin⁻¹', acos: 'cos⁻¹', atan: 'tan⁻¹', sqrt: '√', cbrt: '∛', root: 'ⁿ√' };
const SYMBOL_LABELS: Record<string, string> = { pi: 'π' };
const PLAIN = /^\d+(\.\d+)?$/;

type Op = MathNode & { fn: string; args: MathNode[] };
type Call = MathNode & { fn: { name: string }; args: MathNode[] };
type Step = Op | Call;
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

/** Next operation to do: deepest brackets first (a function's brackets count), then BODMAS priority, then leftmost. */
function nextOperation(root: MathNode): Step | null {
  let best: { node: Step; depth: number; priority: number } | null = null;
  const offer = (node: Step, depth: number, priority: number) => {
    if (!best || depth > best.depth || (depth === best.depth && priority > best.priority)) best = { node, depth, priority };
  };
  const visit = (node: MathNode, depth: number) => {
    if (node.type === 'ParenthesisNode') return visit((node as unknown as { content: MathNode }).content, depth + 1);
    if (node.type === 'FunctionNode') {
      const call = node as Call;
      if (call.args.every(isConstant)) offer(call, depth + 1, FUNCTION_PRIORITY);
      else call.args.forEach((arg) => visit(arg, depth + 1));
      return;
    }
    if (node.type !== 'OperatorNode') return;
    const op = node as Op;
    if (op.args.length === 2 && op.args.every(isConstant) && PRIORITY[op.fn]) return offer(op, depth, PRIORITY[op.fn]);
    op.args.forEach((arg) => visit(arg, depth));
  };
  visit(root, 0);
  return (best as { node: Step } | null)?.node ?? null;
}

const show = (value: BigNumber) => formatNumber(value.toString()).replace(/-/g, '−');

function print(root: MathNode): string {
  if (isConstant(root)) return show(valueOf(root));
  const options = {
    parenthesis: 'keep',
    implicit: 'hide',
    handler: (node: MathNode): string | undefined => {
      if (node.type === 'SymbolNode') {
        const name = (node as unknown as { name: string }).name;
        return SYMBOL_LABELS[name];
      }
      if (node.type === 'FunctionNode') {
        const call = node as Call;
        const args = call.args.map((arg) => arg.toString(options));
        if (call.fn.name === 'fact') return isConstant(call.args[0]) && !valueOf(call.args[0]).isNegative() ? `${args[0]}!` : `(${args[0]})!`;
        return `${FUNCTION_LABELS[call.fn.name] ?? call.fn.name}(${args.join(', ')})`;
      }
      if (node.type === 'OperatorNode' && (node as unknown as { implicit?: boolean }).implicit) {
        // 2π stays 2π, but once both sides are numbers it reads 2 × 3.14159265359.
        const [a, b] = (node as Op).args;
        return isConstant(b) ? `${a.toString(options)} × ${b.toString(options)}` : `${a.toString(options)}${b.toString(options)}`;
      }
      if (node.type !== 'ConstantNode') return undefined;
      const value = (node as Constant).value;
      return value.isNegative() ? `(${show(value)})` : show(value);
    },
  };
  const text = root.toString(options);
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
export function workingFor(expression: string, ans = '0', options: CalcOptions = {}): Working | null {
  const engine = calculate(expression, ans, options);
  // % is rewritten by mathjs into a different tree, so it gets no breakdown (yet).
  if (!engine.ok || expression.includes('%')) return null;

  const scope = evaluationScope(ans, options);
  const isName = (n: MathNode, path: string, parent: MathNode | null) => n.type === 'SymbolNode' && !(parent?.type === 'FunctionNode' && path === 'fn');
  const nameOf = (n: MathNode) => (n as unknown as { name: string }).name;
  const steps: BreakdownStep[] = [];
  let tree: MathNode;
  let start: string;
  try {
    // Ans is shown as its value from the start; π, e and letters are substituted as the first step.
    tree = tidy(parseExpression(expression, new Set(lettersIn(expression))).transform((n, path, parent) =>
      isName(n, path, parent) && nameOf(n) === 'Ans' ? constant(math.bignumber(ans)) : n,
    ));
    start = print(tree);
    const substituted = new Map<string, BigNumber>();
    tree = tidy(tree.transform((n, path, parent) => {
      if (!isName(n, path, parent)) return n;
      const value = scope[nameOf(n)] as BigNumber;
      substituted.set(nameOf(n), value);
      return constant(value);
    }));
    if (substituted.size) {
      steps.push({
        line: `= ${print(tree)}`,
        op: [...substituted].map(([name, value]) => `${SYMBOL_LABELS[name] ?? name} = ${show(value)}`).join(', '),
        detail: null,
      });
    }

    for (let next = nextOperation(tree); next; next = nextOperation(tree)) {
      if (steps.length >= MAX_STEPS) return null;
      const target = next;
      const value = target.evaluate(scope) as BigNumber;
      if (!math.isBigNumber(value) || !value.isFinite()) return null;
      const before = print(target);
      tree = tidy(tree.transform((n) => (n === target ? constant(value) : n)));
      if (target.type === 'FunctionNode') {
        steps.push({ line: `= ${print(tree)}`, op: `${before} = ${show(value)}`, detail: null });
      } else {
        const op = target as Op;
        const [a, b] = op.args.map(valueOf);
        steps.push({ line: `= ${print(tree)}`, op: `${show(a)} ${SYMBOLS[op.fn]} ${show(b)} = ${show(value)}`, detail: detailFor(op.fn, a, b) });
      }
    }
  } catch {
    return null;
  }

  // Safety net: the breakdown must land on the engine's exact answer.
  if (!steps.length || !isConstant(tree) || !valueOf(tree).eq(math.bignumber(engine.exact))) return null;
  if (steps.length === 1) return steps[0].detail ? { kind: 'grid', grid: steps[0].detail } : null;
  return { kind: 'breakdown', start, steps };
}
