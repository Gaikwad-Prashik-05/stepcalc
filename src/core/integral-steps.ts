import type { BigNumber, MathNode } from 'mathjs';
import { show, type BreakdownStep, type Working } from './breakdown';
import { calculate, evaluationScope, isIntegral, lettersIn, parseExpression, type CalcOptions } from './engine';
import { superscript, toFraction } from './format';
import { math } from './math';

const big = (value: number | string) => math.bignumber(value);
type Kind = 'power' | 'sin' | 'cos' | 'exp' | 'ln';
/** c·xⁿ (kind power), or c times sin x, cos x, eˣ, ln|x|. */
interface Term {
  c: BigNumber;
  kind: Kind;
  n: BigNumber;
}
type Op = MathNode & { fn: string; args: MathNode[] };
type Call = MathNode & { fn: { name: string }; args: MathNode[] };

const unwrap = (node: MathNode): MathNode =>
  node.type === 'ParenthesisNode' ? unwrap((node as unknown as { content: MathNode }).content) : node;
const isX = (node: MathNode) => node.type === 'SymbolNode' && (node as unknown as { name: string }).name === 'x';
const hasX = (node: MathNode) => node.filter(isX).length > 0;

/** The integrand as a sum of terms this file knows a rule for, or null. */
function termsOf(root: MathNode, scope: Record<string, unknown>): Term[] | null {
  const value = (node: MathNode): BigNumber | null => {
    const v: unknown = node.evaluate(scope);
    return math.isBigNumber(v) && v.isFinite() ? v : null;
  };
  /** c·xⁿ for products, quotients and powers of x. */
  const monomial = (raw: MathNode): { c: BigNumber; n: BigNumber } | null => {
    const node = unwrap(raw);
    if (!hasX(node)) {
      const c = value(node);
      return c && { c, n: big(0) };
    }
    if (isX(node)) return { c: big(1), n: big(1) };
    if (node.type === 'FunctionNode' && (node as Call).fn.name === 'sqrt') {
      const inner = monomial((node as Call).args[0]);
      return inner && !inner.c.isNegative() ? { c: inner.c.sqrt(), n: inner.n.div(2) } : null;
    }
    if (node.type !== 'OperatorNode') return null;
    const { fn, args } = node as Op;
    const [a, b] = args.map((arg) => (fn === 'pow' && arg === args[1] ? null : monomial(arg)));
    if (!a) return null;
    if (fn === 'unaryMinus') return { c: a.c.neg(), n: a.n };
    if (fn === 'unaryPlus') return a;
    if (fn === 'multiply' && b) return { c: a.c.times(b.c), n: a.n.plus(b.n) };
    if (fn === 'divide' && b && !b.c.isZero()) return { c: a.c.div(b.c), n: a.n.minus(b.n) };
    if (fn === 'pow' && !hasX(args[1])) {
      const power = value(args[1]);
      // Only a plain x (times a positive number) keeps its meaning under any power.
      if (!power || (!a.c.eq(1) && (a.c.isNegative() || !power.isInteger()))) return null;
      return { c: a.c.pow(power), n: a.n.times(power) };
    }
    return null;
  };

  const terms = (raw: MathNode, factor: BigNumber): Term[] | null => {
    const node = unwrap(raw);
    const single = monomial(node);
    if (single) return [{ c: single.c.times(factor), kind: 'power', n: single.n }];
    if (node.type === 'FunctionNode') {
      const { fn, args } = node as Call;
      const kind = ({ sin: 'sin', cos: 'cos', exp: 'exp' } as Record<string, Kind>)[fn.name];
      return kind && args.length === 1 && isX(unwrap(args[0])) ? [{ c: factor, kind, n: big(0) }] : null;
    }
    if (node.type !== 'OperatorNode') return null;
    const { fn, args } = node as Op;
    if (fn === 'unaryMinus') return terms(args[0], factor.neg());
    if (fn === 'unaryPlus') return terms(args[0], factor);
    if (fn === 'add' || fn === 'subtract') {
      const [a, b] = [terms(args[0], factor), terms(args[1], fn === 'add' ? factor : factor.neg())];
      return a && b && [...a, ...b];
    }
    // e^x, written with the e key
    if (fn === 'pow' && unwrap(args[0]).type === 'SymbolNode' && (unwrap(args[0]) as unknown as { name: string }).name === 'e' && isX(unwrap(args[1]))) {
      return [{ c: factor, kind: 'exp', n: big(0) }];
    }
    // A number times or over something with a rule: 3 sin x, cos x ÷ 2
    const constant = (i: number) => (hasX(args[i]) ? null : value(args[i]));
    if (fn === 'multiply') {
      const [a, b] = [constant(0), constant(1)];
      return a ? terms(args[1], factor.times(a)) : b ? terms(args[0], factor.times(b)) : null;
    }
    if (fn === 'divide') {
      const b = constant(1);
      return b && !b.isZero() ? terms(args[0], factor.div(b)) : null;
    }
    return null;
  };

  try {
    return terms(root, big(1))?.filter((t) => !t.c.isZero()) ?? null;
  } catch {
    return null;
  }
}

const RULES: Record<Kind, string> = {
  power: '',
  sin: 'the integral of sin x is −cos x',
  cos: 'the integral of cos x is sin x',
  exp: 'eˣ is its own integral',
  ln: '',
};

function antiderivative(t: Term): { term: Term; rule: string } {
  if (t.kind === 'sin') return { term: { ...t, c: t.c.neg(), kind: 'cos' }, rule: RULES.sin };
  if (t.kind === 'cos') return { term: { ...t, kind: 'sin' }, rule: RULES.cos };
  if (t.kind === 'exp') return { term: t, rule: RULES.exp };
  if (t.n.isZero()) return { term: { ...t, n: big(1) }, rule: 'a plain number: put x after it' };
  if (t.n.eq(-1)) return { term: { ...t, kind: 'ln' }, rule: 'the integral of 1/x is ln|x|' };
  const up = t.n.plus(1);
  return { term: { ...t, c: t.c.div(up), n: up }, rule: `power rule: add 1 to the power, then divide by the new power, ${show(up)}` };
}

function valueAt(t: Term, x: BigNumber): BigNumber {
  if (t.kind === 'power') return t.c.times(x.pow(t.n));
  if (t.kind === 'ln') return t.c.times(x.abs().ln());
  return t.c.times(t.kind === 'sin' ? x.sin() : t.kind === 'cos' ? x.cos() : x.exp());
}

/** One term without its sign: 3x², x³/3, 2 sin x. */
function termText(t: Term): string {
  const power = t.n.isInteger() ? superscript(t.n.toString()) : `^(${toFraction(t.n.toString()) ?? show(t.n)})`;
  const body = { power: t.n.isZero() ? '' : t.n.eq(1) ? 'x' : `x${power}`, sin: 'sin x', cos: 'cos x', exp: 'eˣ', ln: 'ln|x|' }[t.kind];
  const c = t.c.abs();
  if (!body) return show(c);
  if (c.eq(1)) return body;
  const gap = t.kind === 'power' ? '' : ' ';
  if (c.isInteger()) return `${show(c)}${gap}${body}`;
  const [top, bottom] = toFraction(c.toString())?.split('/') ?? [];
  if (!bottom) return `${show(c)}${gap}${body}`;
  return `${top === '1' ? '' : top + gap}${body}/${bottom}`;
}

function sumText(terms: Term[]): string {
  if (!terms.length) return '0';
  return terms.map((t, i) => (i ? (t.c.isNegative() ? ' − ' : ' + ') : t.c.isNegative() ? '−' : '') + termText(t)).join('');
}

/** A value in the working: 8/3 rather than 2.66666666667 when it is a simple fraction that never ends as a decimal. */
function value(v: BigNumber): string {
  const fraction = v.decimalPlaces() > 6 ? toFraction(v.toString()) : null;
  return fraction ? fraction.replace(/-/g, '−') : show(v);
}

const signed = (t: Term) => (t.c.isNegative() ? '−' : '') + termText(t);

/**
 * Working for a single definite integral ∫(f, a, b): the rule for each term, the antiderivative F,
 * then F(b) − F(a). When there is no pen-and-paper rule here, it says the answer is numerical.
 */
export function integralWorking(expression: string, ans = '0', options: CalcOptions = {}): Working | null {
  const engine = calculate(expression, ans, options);
  if (!engine.ok) return null;
  let call: MathNode;
  try {
    call = unwrap(parseExpression(expression, new Set(lettersIn(expression))));
  } catch {
    return null;
  }
  if (!isIntegral(call)) return null;

  const scope = evaluationScope(ans, options);
  const [f, from, to] = call.args;
  let a: BigNumber;
  let b: BigNumber;
  try {
    [a, b] = [from.evaluate(scope) as BigNumber, to.evaluate(scope) as BigNumber];
  } catch {
    return null;
  }
  const range = `from ${show(a)} to ${show(b)}`;
  const numerical = (start: string, why: string): Working => ({
    kind: 'breakdown',
    start,
    steps: [{ line: `≈ ${engine.display.replace(/-/g, '−')}`, op: why, detail: null }],
  });

  const terms = termsOf(f, scope);
  const shownInput = expression.replace(/^\s*∫\((.*),[^,]*,[^,]*\)\s*$/, '$1');
  if (!terms) return numerical(`∫ ${shownInput} dx, ${range}`, 'no pen-and-paper rule here for this one, so the area is added up numerically, as a Casio does');
  const start = `∫ ${terms.length > 1 ? `(${sumText(terms)})` : sumText(terms)} dx, ${range}`;
  if ((options.angle ?? 'deg') === 'deg' && terms.some((t) => t.kind === 'sin' || t.kind === 'cos')) {
    return numerical(start, 'added up numerically: the sin and cos rules need radians, so switch DEG to RAD for the steps');
  }

  const parts = terms.map((t) => ({ t, ...antiderivative(t) }));
  const anti = parts.map((p) => p.term);
  const F = (x: BigNumber) => anti.reduce((sum, t) => sum.plus(valueAt(t, x)), big(0));
  let [top, bottom]: BigNumber[] = [];
  try {
    [top, bottom] = [F(b), F(a)];
  } catch {
    return null;
  }
  const exact = big(engine.exact);
  // Safety net: the rules must land on the engine's answer (they do not across a break, like 1/x through 0).
  if (!top.isFinite() || !bottom.isFinite() || top.minus(bottom).minus(exact).abs().gt(big('1e-9').times(exact.abs().plus(1)))) {
    return numerical(start, 'added up numerically');
  }

  const steps: BreakdownStep[] = parts.map((p) => ({ line: `∫ ${signed(p.t)} dx = ${signed(p.term)}`, op: p.rule, detail: null }));
  steps.push(
    { line: `F(x) = ${sumText(anti)}`, op: 'put the parts together', detail: null },
    { line: `F(${show(b)}) = ${value(top)}`, op: `put x = ${show(b)}`, detail: null },
    { line: `F(${show(a)}) = ${value(bottom)}`, op: `put x = ${show(a)}`, detail: null },
    { line: `= ${engine.display.replace(/-/g, '−')}`, op: `F(${show(b)}) − F(${show(a)}) = ${value(top)} − ${bottom.isNegative() ? `(${value(bottom)})` : value(bottom)}`, detail: null },
  );
  return { kind: 'breakdown', start, steps };
}
