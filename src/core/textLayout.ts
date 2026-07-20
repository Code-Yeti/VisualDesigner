import type { ShapeNode } from "./model";
import { getLocalSize } from "./geometry";

export const BOUND_TEXT_PADDING = 16;
export const BOUND_TEXT_TOP = 12;

export function boundTextAnchorX(width: number, align: "start" | "middle" | "end"): number {
  if (align === "middle") return width / 2;
  if (align === "end") return width - BOUND_TEXT_PADDING;
  return BOUND_TEXT_PADDING;
}

export interface BoundTextLayout {
  title?: { x: number; y: number };
  subtitle?: { x: number; y: number };
}

/** Stacks title above subtitle, top-padded, matching network.htm's box-title/box-sub rhythm. */
export function getBoundTextLayout(node: ShapeNode): BoundTextLayout {
  if (!node.boundText) return {};
  const { width } = getLocalSize(node);
  let cursorY = BOUND_TEXT_TOP;
  const result: BoundTextLayout = {};

  if (node.boundText.title) {
    const item = node.boundText.title;
    result.title = { x: boundTextAnchorX(width, item.font.align), y: cursorY };
    cursorY += item.font.size * 1.25 + 4;
  }
  if (node.boundText.subtitle) {
    const item = node.boundText.subtitle;
    result.subtitle = { x: boundTextAnchorX(width, item.font.align), y: cursorY };
  }
  return result;
}
