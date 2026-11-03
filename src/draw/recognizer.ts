export interface Point {
  x: number;
  y: number;
}
export type Stroke = Point[];

export interface Alternative {
  label: string;
  /** $P distance: lower is a closer match. */
  distance: number;
}

/** Anything that can read one symbol's strokes; a trained model can replace $P behind this. */
export interface Recognizer {
  recognize(strokes: Stroke[]): Alternative[];
}

interface Template {
  label: string;
  points: CloudPoint[];
  user: boolean;
}
interface CloudPoint extends Point {
  stroke: number;
}

const N = 32;
// A user's own sample counts as a little closer than a built-in one, so teaching wins ties.
const USER_BIAS = 0.85;

/** Resamples all strokes to N points spaced evenly along the pen path, scaled to fit 1×1 and centred. */
export function normalize(strokes: Stroke[]): CloudPoint[] {
  const points: CloudPoint[] = strokes.flatMap((stroke, i) => stroke.map((p) => ({ x: p.x, y: p.y, stroke: i })));
  if (!points.length) return [];
  return translateToOrigin(scale(resample(points)));
}

function resample(points: CloudPoint[]): CloudPoint[] {
  let length = 0;
  for (let i = 1; i < points.length; i++) if (points[i].stroke === points[i - 1].stroke) length += dist(points[i - 1], points[i]);
  const interval = length / (N - 1);
  const out: CloudPoint[] = [{ ...points[0] }];
  if (interval === 0) {
    while (out.length < N) out.push({ ...points[0] });
    return out;
  }
  let carried = 0;
  const pts = points.map((p) => ({ ...p }));
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].stroke !== pts[i - 1].stroke) continue;
    const d = dist(pts[i - 1], pts[i]);
    if (carried + d >= interval && d > 0) {
      const t = (interval - carried) / d;
      const q = { x: pts[i - 1].x + t * (pts[i].x - pts[i - 1].x), y: pts[i - 1].y + t * (pts[i].y - pts[i - 1].y), stroke: pts[i].stroke };
      out.push(q);
      pts.splice(i, 0, q); // q starts the next segment
      carried = 0;
    } else {
      carried += d;
    }
  }
  while (out.length < N) out.push({ ...pts[pts.length - 1] });
  return out.slice(0, N);
}

function scale(points: CloudPoint[]): CloudPoint[] {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) || 1;
  const [minX, minY] = [Math.min(...xs), Math.min(...ys)];
  return points.map((p) => ({ x: (p.x - minX) / size, y: (p.y - minY) / size, stroke: p.stroke }));
}

function translateToOrigin(points: CloudPoint[]): CloudPoint[] {
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  return points.map((p) => ({ x: p.x - cx, y: p.y - cy, stroke: p.stroke }));
}

// Not Math.hypot: it is several times slower, and this runs ~10⁵ times per symbol.
const dist = (a: Point, b: Point) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
};

/** Weighted greedy matching cost; gives up early once it cannot beat `limit`. */
function cloudDistance(a: CloudPoint[], b: CloudPoint[], start: number, limit: number): number {
  const matched = new Array<boolean>(N).fill(false);
  let sum = 0;
  let i = start;
  do {
    if (sum >= limit) return sum;
    let min = Infinity;
    let index = 0;
    for (let j = 0; j < N; j++) {
      if (matched[j]) continue;
      const d = dist(a[i], b[j]);
      if (d < min) [min, index] = [d, j];
    }
    matched[index] = true;
    sum += (1 - ((i - start + N) % N) / N) * min;
    i = (i + 1) % N;
  } while (i !== start);
  return sum;
}

function greedyCloudMatch(points: CloudPoint[], template: CloudPoint[], limit: number): number {
  const step = Math.floor(Math.sqrt(N));
  let min = limit;
  for (let i = 0; i < N; i += step) {
    min = Math.min(min, cloudDistance(points, template, i, min));
    min = Math.min(min, cloudDistance(template, points, i, min));
  }
  return min;
}

/** The $P point-cloud recogniser (Vatavu, Anthony & Wobbrock, 2012): stroke order and direction do not matter. */
export class PointCloudRecognizer implements Recognizer {
  private templates: Template[] = [];

  constructor(builtIn: readonly { label: string; strokes: Stroke[] }[] = []) {
    for (const t of builtIn) this.add(t.label, t.strokes, false);
  }

  add(label: string, strokes: Stroke[], user = true): void {
    const points = normalize(strokes);
    if (points.length === N) this.templates.push({ label, points, user });
  }

  /** Every label once, closest first. */
  recognize(strokes: Stroke[]): Alternative[] {
    const points = normalize(strokes);
    if (points.length !== N) return [];
    const best = new Map<string, number>();
    for (const t of this.templates) {
      const bias = t.user ? USER_BIAS : 1;
      // Only worth finishing if it could beat this label's best so far.
      const limit = (best.get(t.label) ?? Infinity) / bias;
      const d = greedyCloudMatch(points, t.points, limit) * bias;
      if (d < (best.get(t.label) ?? Infinity)) best.set(t.label, d);
    }
    return [...best].map(([label, distance]) => ({ label, distance })).sort((a, b) => a.distance - b.distance);
  }
}

/** A sample reduced to its 32 normalised points (as strokes), small enough to keep many on the device. */
export function compact(strokes: Stroke[]): Stroke[] {
  const out: Stroke[] = [];
  for (const p of normalize(strokes)) {
    (out[p.stroke] ??= []).push({ x: Math.round(p.x * 1000) / 1000, y: Math.round(p.y * 1000) / 1000 });
  }
  return out.filter(Boolean);
}
