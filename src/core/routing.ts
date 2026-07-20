import type { RoutingKind } from "./model";

export interface RoutingOptions {
  routing: RoutingKind;
  cornerRadius: number;
  stubLength: number;
}

type Side = "n" | "e" | "s" | "w" | "custom";
type Point = { x: number; y: number };

function directionVector(side: Side): Point {
  switch (side) {
    case "n":
      return { x: 0, y: -1 };
    case "s":
      return { x: 0, y: 1 };
    case "e":
      return { x: 1, y: 0 };
    case "w":
      return { x: -1, y: 0 };
    default:
      return { x: 0, y: 0 };
  }
}

export function computePath(source: Point, sourceSide: Side, target: Point, targetSide: Side, options: RoutingOptions): string {
  if (options.routing === "straight") {
    return `M${source.x},${source.y} L${target.x},${target.y}`;
  }
  if (options.routing === "bezier") {
    return computeBezierPath(source, sourceSide, target, targetSide, options);
  }
  return computeOrthogonalPath(source, sourceSide, target, targetSide, options);
}

function computeBezierPath(source: Point, sourceSide: Side, target: Point, targetSide: Side, options: RoutingOptions): string {
  const ds = directionVector(sourceSide);
  const dt = directionVector(targetSide);
  const tension = Math.max(40, options.stubLength * 2);
  const c1 = { x: source.x + ds.x * tension, y: source.y + ds.y * tension };
  const c2 = { x: target.x + dt.x * tension, y: target.y + dt.y * tension };
  return `M${source.x},${source.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${target.x},${target.y}`;
}

/** Direction-aware Manhattan routing with rounded corners, reproducing network.htm's hand-drawn elbow paths. Not an obstacle-avoiding router. */
function computeOrthogonalPath(source: Point, sourceSide: Side, target: Point, targetSide: Side, options: RoutingOptions): string {
  const stub = options.stubLength;
  const ds = directionVector(sourceSide);
  const dt = directionVector(targetSide);

  const p1 = { x: source.x + ds.x * stub, y: source.y + ds.y * stub };
  const p2 = { x: target.x + dt.x * stub, y: target.y + dt.y * stub };

  const sourceIsVertical = ds.x === 0 && ds.y !== 0;
  const mid = sourceIsVertical ? { x: p1.x, y: p2.y } : { x: p2.x, y: p1.y };

  return buildRoundedPath([source, p1, mid, p2, target], options.cornerRadius);
}

function buildRoundedPath(points: Point[], radius: number): string {
  const cleaned = simplifyPath(points);
  if (cleaned.length < 2) return "";
  let d = `M${cleaned[0].x},${cleaned[0].y}`;

  for (let i = 1; i < cleaned.length - 1; i++) {
    const prev = cleaned[i - 1];
    const curr = cleaned[i];
    const next = cleaned[i + 1];
    const inLen = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    const outLen = Math.hypot(next.x - curr.x, next.y - curr.y);
    const r = Math.min(radius, inLen / 2, outLen / 2);

    if (r < 0.5) {
      d += ` L${curr.x},${curr.y}`;
      continue;
    }
    const inRatio = (inLen - r) / inLen;
    const enter = { x: prev.x + (curr.x - prev.x) * inRatio, y: prev.y + (curr.y - prev.y) * inRatio };
    const outRatio = r / outLen;
    const exit = { x: curr.x + (next.x - curr.x) * outRatio, y: curr.y + (next.y - curr.y) * outRatio };
    d += ` L${enter.x},${enter.y} Q${curr.x},${curr.y} ${exit.x},${exit.y}`;
  }

  const last = cleaned[cleaned.length - 1];
  d += ` L${last.x},${last.y}`;
  return d;
}

/** Drops duplicate points and interior points that don't represent a real corner. */
function simplifyPath(points: Point[]): Point[] {
  const deduped: Point[] = [];
  for (const pt of points) {
    const last = deduped[deduped.length - 1];
    if (last && Math.abs(last.x - pt.x) < 0.01 && Math.abs(last.y - pt.y) < 0.01) continue;
    deduped.push(pt);
  }
  const result: Point[] = [];
  for (let i = 0; i < deduped.length; i++) {
    if (i === 0 || i === deduped.length - 1) {
      result.push(deduped[i]);
      continue;
    }
    const prev = deduped[i - 1];
    const curr = deduped[i];
    const next = deduped[i + 1];
    const cross = (curr.x - prev.x) * (next.y - prev.y) - (curr.y - prev.y) * (next.x - prev.x);
    if (Math.abs(cross) > 0.01) result.push(curr);
  }
  return result;
}
