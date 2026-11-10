// Builds src/draw/handwriting-data.ts from real pen strokes, and reports accuracy on writers kept out of it.
// Not part of the normal test run. To rebuild:
//   1. download ujipenchars2.txt (UJI Pen Characters v2, CC BY 4.0) from
//      https://archive.ics.uci.edu/ml/machine-learning-databases/uji-penchars/version2/ujipenchars2.txt
//   2. UJI=/path/to/ujipenchars2.txt npx vitest run scripts/handwriting-data.test.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { greedyCloudMatch, normalize, pack, PointCloudRecognizer, TUNING, type Oriented, type Stroke } from '../src/draw/recognizer';

if (process.env.HEADING) TUNING.heading = Number(process.env.HEADING);
import { BUILT_IN_TEMPLATES } from '../src/draw/templates';

const LABELS = '0123456789abcdegilnostxy()'.split('');
const PER_LABEL = Number(process.env.PER_LABEL ?? 12);
// Shapes people write the same way; the layout offers the other reading with a tap, so either counts.
const SAME: Record<string, string> = { l: '1', i: '1', o: '0', s: '5', g: '9', c: '(' };
const same = (label: string) => SAME[label] ?? label;
const confusions: Record<string, number> = {};

interface Sample {
  label: string;
  test: boolean;
  strokes: Stroke[];
  points: Oriented[];
}

function parse(text: string): Sample[] {
  const samples: Sample[] = [];
  let current: Sample | null = null;
  for (const line of text.split(/\r?\n/)) {
    const word = /^WORD (\S+) (trn|tst)/.exec(line);
    if (word) {
      current = LABELS.includes(word[1]) ? { label: word[1], test: word[2] === 'tst', strokes: [], points: [] } : null;
      if (current) samples.push(current);
      continue;
    }
    const points = /^\s*POINTS \d+ # (.*)$/.exec(line);
    if (!points || !current) continue;
    const n = points[1].trim().split(/\s+/).map(Number);
    current.strokes.push(Array.from({ length: n.length / 2 }, (_, i) => ({ x: n[2 * i], y: n[2 * i + 1] })));
  }
  for (const s of samples) s.points = normalize(s.strokes);
  return samples.filter((s) => s.points.length === 32);
}

/** The k samples that between them sit closest to every other sample of the label (greedy k-medoids). */
function pick(samples: Sample[], k: number): Sample[] {
  const n = samples.length;
  const d = samples.map((a) => samples.map((b) => greedyCloudMatch(a.points, b.points)));
  const nearest = Array<number>(n).fill(Infinity);
  const chosen: number[] = [];
  while (chosen.length < Math.min(k, n)) {
    let best = -1;
    let bestCost = Infinity;
    for (let c = 0; c < n; c++) {
      if (chosen.includes(c)) continue;
      let cost = 0;
      for (let i = 0; i < n; i++) cost += Math.min(nearest[i], d[c][i]);
      if (cost < bestCost) [best, bestCost] = [c, cost];
    }
    chosen.push(best);
    for (let i = 0; i < n; i++) nearest[i] = Math.min(nearest[i], d[best][i]);
  }
  return chosen.map((i) => samples[i]);
}

function accuracy(recognizer: PointCloudRecognizer, test: Sample[]): { exact: number; lookAlike: number; digits: number } {
  let [exact, lookAlike, digits, digitTotal] = [0, 0, 0, 0];
  for (const s of test) {
    const bias = Number(process.env.DIGIT_BIAS ?? 1);
    const top = recognizer.recognize(s.strokes).map((r) => ({ ...r, distance: r.distance * (/\d/.test(r.label) ? bias : 1) })).sort((x, y) => x.distance - y.distance)[0]?.label;
    if (top !== undefined && same(top) !== same(s.label)) confusions[`${s.label}→${top}`] = (confusions[`${s.label}→${top}`] ?? 0) + 1;
    if (top === s.label) exact++;
    if (top !== undefined && same(top) === same(s.label)) lookAlike++;
    if (/\d/.test(s.label)) {
      digitTotal++;
      if (top !== undefined && same(top) === s.label) digits++;
    }
  }
  const pct = (n: number, of: number) => Math.round((1000 * n) / of) / 10;
  return { exact: pct(exact, test.length), lookAlike: pct(lookAlike, test.length), digits: pct(digits, digitTotal) };
}

it.runIf(process.env.UJI)('builds handwriting-data.ts', { timeout: 30 * 60_000 }, () => {
  const samples = parse(readFileSync(process.env.UJI!, 'latin1'));
  const train = samples.filter((s) => !s.test);
  const test = samples.filter((s) => s.test);

  const before = accuracy(new PointCloudRecognizer(BUILT_IN_TEMPLATES), test);
  for (const key of Object.keys(confusions)) delete confusions[key];
  const data: Record<string, string[]> = {};
  for (const label of LABELS) data[label] = pick(train.filter((s) => s.label === label), PER_LABEL).map((s) => pack(s.points));
  const recognizer = new PointCloudRecognizer(BUILT_IN_TEMPLATES);
  for (const [label, packed] of Object.entries(data)) recognizer.addPacked(label, packed);
  const after = accuracy(recognizer, test);
  const worst = Object.entries(confusions).sort((x, y) => y[1] - x[1]).slice(0, 25).map(([k, v]) => `${k}:${v}`).join(' ');
  const report = { heading: TUNING.heading, perLabel: PER_LABEL, testSamples: test.length, before, after, worst };
  console.log(JSON.stringify(report));
  if (process.env.REPORT) writeFileSync(process.env.REPORT, JSON.stringify(report) + '\n', { flag: 'a' });
  if (process.env.DRY) return;

  writeFileSync(
    new URL('../src/draw/handwriting-data.ts', import.meta.url),
    `// Generated by scripts/handwriting-data.test.ts. Do not edit.
// Real handwriting: ${PER_LABEL} representative samples per symbol from the UJI Pen Characters (Version 2) data set,
// D. Llorens et al., Universitat Jaume I, via the UCI Machine Learning Repository. Licensed CC BY 4.0.
// On the ${test.length} test samples from writers not used here: ${after.lookAlike}% read right (digits ${after.digits}%),
// against ${before.lookAlike}% (digits ${before.digits}%) with the drawn-by-formula shapes alone.
export const HANDWRITING: Record<string, readonly string[]> = ${JSON.stringify(data, null, 1)};
`,
  );
});
