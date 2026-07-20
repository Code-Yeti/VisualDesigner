import type { Point, RoutingKind } from "./model";

export interface RoutingOptions {
  routing: RoutingKind;
  cornerRadius: number;
  stubLength: number;
  /** User-placed bend points (orthogonal only) - see `ConnectorNode.waypoints`. */
  waypoints?: Point[];
  /** User-dragged bezier handles - see `ConnectorNode.bezierControls`. */
  bezierControls?: { c1: Point; c2: Point };
}

type Side = "n" | "e" | "s" | "w" | "custom";

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

/** The two bezier control points that are actually in effect - the user's dragged handles if set, otherwise the auto-computed tension-based defaults. Exported so the handle overlay can draw/drag the same points the path itself uses. */
export function getBezierHandlePoints(source: Point, sourceSide: Side, target: Point, targetSide: Side, options: RoutingOptions): { c1: Point; c2: Point } {
  if (options.bezierControls) return options.bezierControls;
  const ds = directionVector(sourceSide);
  const dt = directionVector(targetSide);
  const tension = Math.max(40, options.stubLength * 2);
  return {
    c1: { x: source.x + ds.x * tension, y: source.y + ds.y * tension },
    c2: { x: target.x + dt.x * tension, y: target.y + dt.y * tension },
  };
}

function computeBezierPath(source: Point, sourceSide: Side, target: Point, targetSide: Side, options: RoutingOptions): string {
  const { c1, c2 } = getBezierHandlePoints(source, sourceSide, target, targetSide, options);
  return `M${source.x},${source.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${target.x},${target.y}`;
}

/** The single auto-computed elbow used when a connector has no user-placed waypoints yet - what the first drag/double-click starts from. */
function autoMidpoint(source: Point, sourceSide: Side, target: Point, targetSide: Side, stub: number): Point {
  const ds = directionVector(sourceSide);
  const p1 = { x: source.x + ds.x * stub, y: source.y + ds.y * stub };
  const dt = directionVector(targetSide);
  const p2 = { x: target.x + dt.x * stub, y: target.y + dt.y * stub };
  const sourceIsVertical = ds.x === 0 && ds.y !== 0;
  return sourceIsVertical ? { x: p1.x, y: p2.y } : { x: p2.x, y: p1.y };
}

/** The bend points currently in effect for an orthogonal connector - the user's `waypoints` if any, otherwise the single auto-computed elbow. Exported so the handle overlay always shows/drags the same point(s) the rendered path actually bends through. */
export function getOrthogonalBendPoints(source: Point, sourceSide: Side, target: Point, targetSide: Side, options: RoutingOptions): Point[] {
  if (options.waypoints && options.waypoints.length > 0) return options.waypoints;
  return [autoMidpoint(source, sourceSide, target, targetSide, options.stubLength)];
}

/** Direction-aware Manhattan routing with rounded corners, reproducing network.htm's hand-drawn elbow paths. Not an obstacle-avoiding router. */
function computeOrthogonalPath(source: Point, sourceSide: Side, target: Point, targetSide: Side, options: RoutingOptions): string {
  const stub = options.stubLength;
  const ds = directionVector(sourceSide);
  const dt = directionVector(targetSide);
  const p1 = { x: source.x + ds.x * stub, y: source.y + ds.y * stub };
  const p2 = { x: target.x + dt.x * stub, y: target.y + dt.y * stub };

  if (!options.waypoints || options.waypoints.length === 0) {
    const mid = autoMidpoint(source, sourceSide, target, targetSide, stub);
    return buildRoundedPath([source, p1, mid, p2, target], options.cornerRadius);
  }

  // User-placed bends: thread source -> stub -> each waypoint (in order) ->
  // stub -> target, inserting one Manhattan corner between any consecutive
  // pair that isn't already axis-aligned, alternating orientation starting
  // from the source stub's own direction so a freshly-dragged/added bend
  // continues in a natural zigzag instead of requiring the user to also
  // manage which axis moves first.
  const chain = [source, p1, ...options.waypoints, p2, target];
  const points: Point[] = [chain[0]];
  let vertical = ds.x === 0 && ds.y !== 0;
  for (let i = 1; i < chain.length; i++) {
    const prev = points[points.length - 1];
    const curr = chain[i];
    const aligned = Math.abs(prev.x - curr.x) < 0.01 || Math.abs(prev.y - curr.y) < 0.01;
    if (!aligned) points.push(vertical ? { x: prev.x, y: curr.y } : { x: curr.x, y: prev.y });
    vertical = !vertical;
    points.push(curr);
  }
  return buildRoundedPath(points, options.cornerRadius);
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
