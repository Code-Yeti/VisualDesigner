import type { ShapeNode } from "./model";

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
