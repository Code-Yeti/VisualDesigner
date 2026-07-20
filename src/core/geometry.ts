import type { Port, Project, ShapeGeometry, ShapeNode, TextNode } from "./model";
import { getGroupDescendantIds } from "./mutations";

export type HandleId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
export const HANDLE_IDS: HandleId[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getLocalSize(node: ShapeNode): { width: number; height: number } {
  switch (node.geometry.kind) {
    case "rect":
      return { width: node.geometry.width, height: node.geometry.height };
    case "ellipse":
      return { width: node.geometry.rx * 2, height: node.geometry.ry * 2 };
    case "cloud":
      return { width: node.geometry.width, height: node.geometry.height };
    case "polygon": {
      const xs = node.geometry.points.map((p) => p.x);
      const ys = node.geometry.points.map((p) => p.y);
      return {
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
      };
    }
  }
}

export function getWorldBBox(node: ShapeNode): BBox {
  const size = getLocalSize(node);
  return { x: node.transform.x, y: node.transform.y, ...size };
}

// Rough average glyph-advance width relative to font size for a typical
// sans-serif - not exact glyph metrics (that needs DOM measurement), but
// good enough to place resize handles and compute a resize's scale factor.
const TEXT_AVG_CHAR_WIDTH_FACTOR = 0.56;

/**
 * Approximate world bbox for a standalone text node. `buildTextElement`
 * anchors content at local (0, font.size) with `text-anchor` following
 * `font.align`, so `transform.x` is the *anchor point* (left/center/right),
 * not necessarily the box's left edge - shifted here to derive a consistent
 * left-edge x.
 */
export function getTextWorldBBox(node: TextNode): BBox {
  const lines = node.content.length ? node.content.split("\n") : [""];
  const lineHeight = node.font.size * 1.25;
  const longest = Math.max(1, ...lines.map((l) => l.length));
  const width = Math.max(20, longest * node.font.size * TEXT_AVG_CHAR_WIDTH_FACTOR);
  const height = Math.max(node.font.size, lines.length * lineHeight);

  let x = node.transform.x;
  if (node.font.align === "middle") x -= width / 2;
  else if (node.font.align === "end") x -= width;
  return { x, y: node.transform.y, width, height };
}

/**
 * A text node has no independent width/height - only `font.size` - so a
 * handle drag is translated into a scale factor (single-axis for edge
 * handles, averaged for corners) applied to font size, then the box is
 * re-derived from that new size and re-anchored on the edge/corner opposite
 * the dragged handle, the same as a shape resize.
 */
export function resizeTextFontSize(node: TextNode, handle: HandleId, orig: BBox, dragged: BBox): { fontSize: number; x: number; y: number } {
  const widthRatio = orig.width > 0 ? dragged.width / orig.width : 1;
  const heightRatio = orig.height > 0 ? dragged.height / orig.height : 1;
  const scale = handle === "n" || handle === "s" ? heightRatio : handle === "e" || handle === "w" ? widthRatio : (widthRatio + heightRatio) / 2;
  // Matches the Properties panel's font-size input range (fontFieldsHtml) so
  // dragging a handle can't reach a size the manual field itself would reject.
  const fontSize = Math.min(120, Math.max(6, node.font.size * scale));

  const newBBox = getTextWorldBBox({ ...node, font: { ...node.font, size: fontSize } });

  let x = orig.x;
  let y = orig.y;
  if (handle.includes("w")) x = orig.x + orig.width - newBBox.width;
  if (handle.includes("n")) y = orig.y + orig.height - newBBox.height;

  // x/y above are the box's left/top edge; translate back to the
  // align-based anchor point that transform.x actually stores.
  let transformX = x;
  if (node.font.align === "middle") transformX = x + newBBox.width / 2;
  else if (node.font.align === "end") transformX = x + newBBox.width;

  return { fontSize, x: transformX, y };
}

/** Union bbox of a group's descendant shapes; groups have no geometry of their own. */
export function getGroupWorldBBox(project: Project, groupId: string): BBox | null {
  const ids = getGroupDescendantIds(project, groupId);
  let bbox: BBox | null = null;
  for (const id of ids) {
    const node = project.nodes[id];
    if (!node || !("geometry" in node)) continue;
    const b = getWorldBBox(node as ShapeNode);
    if (!bbox) {
      bbox = { ...b };
    } else {
      const minX = Math.min(bbox.x, b.x);
      const minY = Math.min(bbox.y, b.y);
      const maxX = Math.max(bbox.x + bbox.width, b.x + b.width);
      const maxY = Math.max(bbox.y + bbox.height, b.y + b.height);
      bbox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
  }
  return bbox;
}

export function snapValue(v: number, gridSize: number): number {
  return Math.round(v / gridSize) * gridSize;
}

export function defaultPorts(): Port[] {
  return [
    { id: "n", x: 0.5, y: 0, side: "n" },
    { id: "e", x: 1, y: 0.5, side: "e" },
    { id: "s", x: 0.5, y: 1, side: "s" },
    { id: "w", x: 0, y: 0.5, side: "w" },
  ];
}

/** Resolves a port's fractional local coordinates into a live world-space point, so connectors never store stale coordinates. */
export function resolvePortWorldPos(node: ShapeNode, port: Port): { x: number; y: number } {
  const { width, height } = getLocalSize(node);
  return { x: node.transform.x + port.x * width, y: node.transform.y + port.y * height };
}

export function handleWorldPos(bbox: BBox, handle: HandleId): { x: number; y: number } {
  const { x, y, width, height } = bbox;
  switch (handle) {
    case "nw":
      return { x, y };
    case "n":
      return { x: x + width / 2, y };
    case "ne":
      return { x: x + width, y };
    case "e":
      return { x: x + width, y: y + height / 2 };
    case "se":
      return { x: x + width, y: y + height };
    case "s":
      return { x: x + width / 2, y: y + height };
    case "sw":
      return { x, y: y + height };
    case "w":
      return { x, y: y + height / 2 };
  }
}

/** Resizes `orig` by drag delta (dx, dy), anchored on the opposite edge/corner from `handle`. */
export function computeResizedBBox(orig: BBox, handle: HandleId, dx: number, dy: number, minSize = 8): BBox {
  let { x, y, width, height } = orig;

  if (handle.includes("e")) width = Math.max(minSize, orig.width + dx);
  if (handle.includes("s")) height = Math.max(minSize, orig.height + dy);
  if (handle.includes("w")) {
    const newWidth = Math.max(minSize, orig.width - dx);
    x = orig.x + (orig.width - newWidth);
    width = newWidth;
  }
  if (handle.includes("n")) {
    const newHeight = Math.max(minSize, orig.height - dy);
    y = orig.y + (orig.height - newHeight);
    height = newHeight;
  }

  return { x, y, width, height };
}

/** Produces updated geometry for a shape resized from `orig` bbox to `next` bbox. */
export function resizeGeometry(geometry: ShapeGeometry, orig: BBox, next: BBox): ShapeGeometry {
  switch (geometry.kind) {
    case "rect":
      return { ...geometry, width: next.width, height: next.height };
    case "ellipse":
      return { ...geometry, rx: next.width / 2, ry: next.height / 2 };
    case "cloud":
      return { ...geometry, width: next.width, height: next.height };
    case "polygon": {
      const scaleX = orig.width > 0 ? next.width / orig.width : 1;
      const scaleY = orig.height > 0 ? next.height / orig.height : 1;
      return {
        ...geometry,
        points: geometry.points.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY })),
      };
    }
  }
}
