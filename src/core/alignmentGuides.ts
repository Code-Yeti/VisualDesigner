import type { BBox } from "./geometry";

export interface Guide {
  axis: "x" | "y";
  position: number;
  from: number;
  to: number;
}

export interface AlignmentResult {
  dx: number;
  dy: number;
  guides: Guide[];
}

/**
 * Finds the smallest snap needed to align `dragged`'s left/center/right (and
 * top/center/bottom) with any other shape's, within `threshold` world units.
 * Only the single best snap per axis is applied - not cumulative across
 * every near-match - so the dragged shape doesn't get pulled in conflicting
 * directions by multiple candidates at once.
 */
export function computeAlignmentGuides(dragged: BBox, others: BBox[], threshold: number): AlignmentResult {
  const draggedXs = [dragged.x, dragged.x + dragged.width / 2, dragged.x + dragged.width];
  const draggedYs = [dragged.y, dragged.y + dragged.height / 2, dragged.y + dragged.height];

  let bestDx = 0;
  let bestDxAbs = Infinity;
  let bestDy = 0;
  let bestDyAbs = Infinity;

  for (const other of others) {
    const otherXs = [other.x, other.x + other.width / 2, other.x + other.width];
    const otherYs = [other.y, other.y + other.height / 2, other.y + other.height];
    for (const dx of draggedXs) {
      for (const ox of otherXs) {
        const diff = ox - dx;
        if (Math.abs(diff) <= threshold && Math.abs(diff) < bestDxAbs) {
          bestDxAbs = Math.abs(diff);
          bestDx = diff;
        }
      }
    }
    for (const dy of draggedYs) {
      for (const oy of otherYs) {
        const diff = oy - dy;
        if (Math.abs(diff) <= threshold && Math.abs(diff) < bestDyAbs) {
          bestDyAbs = Math.abs(diff);
          bestDy = diff;
        }
      }
    }
  }

  const snappedDragged: BBox = { x: dragged.x + bestDx, y: dragged.y + bestDy, width: dragged.width, height: dragged.height };
  const guides: Guide[] = [];
  const snappedXs = [snappedDragged.x, snappedDragged.x + snappedDragged.width / 2, snappedDragged.x + snappedDragged.width];
  const snappedYs = [snappedDragged.y, snappedDragged.y + snappedDragged.height / 2, snappedDragged.y + snappedDragged.height];

  for (const other of others) {
    const otherXs = [other.x, other.x + other.width / 2, other.x + other.width];
    const otherYs = [other.y, other.y + other.height / 2, other.y + other.height];
    if (bestDxAbs < Infinity) {
      for (const sx of snappedXs) {
        for (const ox of otherXs) {
          if (Math.abs(sx - ox) < 0.5) {
            const top = Math.min(snappedDragged.y, other.y);
            const bottom = Math.max(snappedDragged.y + snappedDragged.height, other.y + other.height);
            guides.push({ axis: "x", position: sx, from: top, to: bottom });
          }
        }
      }
    }
    if (bestDyAbs < Infinity) {
      for (const sy of snappedYs) {
        for (const oy of otherYs) {
          if (Math.abs(sy - oy) < 0.5) {
            const left = Math.min(snappedDragged.x, other.x);
            const right = Math.max(snappedDragged.x + snappedDragged.width, other.x + other.width);
            guides.push({ axis: "y", position: sy, from: left, to: right });
          }
        }
      }
    }
  }

  return { dx: bestDxAbs < Infinity ? bestDx : 0, dy: bestDyAbs < Infinity ? bestDy : 0, guides };
}
