import type { NodeId, Project, ShapeNode } from "./model";
import { SHAPE_NODE_TYPES } from "./model";
import { getGroupDescendantIds, updateNode } from "./mutations";
import { getGroupWorldBBox, getWorldBBox, type BBox } from "./geometry";

export type AlignMode = "left" | "centerX" | "right" | "top" | "centerY" | "bottom";

/** Text nodes have no tracked geometry, so they align as a zero-size point at their own position; connectors are skipped. */
function getAlignBBox(project: Project, id: NodeId): BBox | null {
  const node = project.nodes[id];
  if (!node) return null;
  if (node.type === "group") return getGroupWorldBBox(project, id);
  if (node.type === "text") return { x: node.transform.x, y: node.transform.y, width: 0, height: 0 };
  if (SHAPE_NODE_TYPES.has(node.type)) return getWorldBBox(node as ShapeNode);
  return null;
}

function moveByDelta(project: Project, id: NodeId, dx: number, dy: number): Project {
  let next = project;
  for (const leafId of getGroupDescendantIds(next, id)) {
    const node = next.nodes[leafId];
    if (!node) continue;
    next = updateNode(next, leafId, { transform: { ...node.transform, x: node.transform.x + dx, y: node.transform.y + dy } });
  }
  return next;
}

/** Aligns every selected node's edge/center to the extreme (or midpoint) among the whole selection. Groups move as a unit via their member deltas. */
export function alignNodes(project: Project, ids: NodeId[], mode: AlignMode): Project {
  const entries = ids.map((id) => ({ id, bbox: getAlignBBox(project, id) })).filter((e): e is { id: NodeId; bbox: BBox } => !!e.bbox);
  if (entries.length < 2) return project;

  const minX = Math.min(...entries.map((e) => e.bbox.x));
  const maxX = Math.max(...entries.map((e) => e.bbox.x + e.bbox.width));
  const minY = Math.min(...entries.map((e) => e.bbox.y));
  const maxY = Math.max(...entries.map((e) => e.bbox.y + e.bbox.height));

  let next = project;
  for (const { id, bbox } of entries) {
    let dx = 0;
    let dy = 0;
    switch (mode) {
      case "left":
        dx = minX - bbox.x;
        break;
      case "right":
        dx = maxX - (bbox.x + bbox.width);
        break;
      case "centerX":
        dx = (minX + maxX) / 2 - (bbox.x + bbox.width / 2);
        break;
      case "top":
        dy = minY - bbox.y;
        break;
      case "bottom":
        dy = maxY - (bbox.y + bbox.height);
        break;
      case "centerY":
        dy = (minY + maxY) / 2 - (bbox.y + bbox.height / 2);
        break;
    }
    next = moveByDelta(next, id, dx, dy);
  }
  return next;
}

/** Spaces out the interiors of 3+ selected nodes evenly along one axis, keeping the two extreme nodes fixed. */
export function distributeNodes(project: Project, ids: NodeId[], axis: "x" | "y"): Project {
  const entries = ids.map((id) => ({ id, bbox: getAlignBBox(project, id) })).filter((e): e is { id: NodeId; bbox: BBox } => !!e.bbox);
  if (entries.length < 3) return project;

  const sorted = [...entries].sort((a, b) => (axis === "x" ? a.bbox.x - b.bbox.x : a.bbox.y - b.bbox.y));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const span = axis === "x" ? last.bbox.x + last.bbox.width - first.bbox.x : last.bbox.y + last.bbox.height - first.bbox.y;
  const totalSize = sorted.reduce((sum, e) => sum + (axis === "x" ? e.bbox.width : e.bbox.height), 0);
  const gap = (span - totalSize) / (sorted.length - 1);

  let next = project;
  let cursor = axis === "x" ? first.bbox.x : first.bbox.y;
  for (const { id, bbox } of sorted) {
    const dx = axis === "x" ? cursor - bbox.x : 0;
    const dy = axis === "y" ? cursor - bbox.y : 0;
    next = moveByDelta(next, id, dx, dy);
    cursor += (axis === "x" ? bbox.width : bbox.height) + gap;
  }
  return next;
}
