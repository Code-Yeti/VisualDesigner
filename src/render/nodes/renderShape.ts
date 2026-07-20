import type { EllipseGeom, RectGeom, ShapeNode } from "@/core/model";
import { svgEl, setAttrs, SVG_NS } from "../svgUtil";

interface ShapeElCache {
  shapeEl: SVGElement;
  kind: string;
}

const cache = new Map<string, ShapeElCache>();

function fillValue(node: ShapeNode): string {
  const { fill } = node.style;
  if (fill.kind === "solid") return fill.color;
  if (fill.kind === "gradient") return `url(#${fill.gradientId})`;
  return "none";
}

export function renderShapeNode(g: SVGGElement, node: ShapeNode): void {
  const t = node.transform;
  setAttrs(g, {
    transform: `translate(${t.x} ${t.y}) rotate(${t.rotation})`,
    opacity: node.visible === false ? 0 : undefined,
  });

  const kind = node.geometry.kind;
  let entry = cache.get(node.id);
  if (!entry || entry.kind !== kind) {
    entry?.shapeEl.remove();
    const tag = kind === "ellipse" ? "ellipse" : "rect"; // polygon/cloud/pill added in M2
    const shapeEl = document.createElementNS(SVG_NS, tag);
    g.insertBefore(shapeEl, g.firstChild);
    entry = { shapeEl, kind };
    cache.set(node.id, entry);
  }

  const style = node.style;
  const fill = fillValue(node);
  const common = {
    fill,
    stroke: style.stroke,
    "stroke-width": style.strokeWidth,
    opacity: style.opacity,
    filter: style.filterId ? `url(#${style.filterId})` : undefined,
    "pointer-events": "all",
  };

  if (kind === "rect") {
    const geom = node.geometry as RectGeom;
    setAttrs(entry.shapeEl, { x: 0, y: 0, width: geom.width, height: geom.height, rx: geom.rx, ry: geom.ry, ...common });
  } else if (kind === "ellipse") {
    const geom = node.geometry as EllipseGeom;
    setAttrs(entry.shapeEl, { cx: geom.rx, cy: geom.ry, rx: geom.rx, ry: geom.ry, ...common });
  }
}

export function disposeShapeCache(id: string): void {
  cache.delete(id);
}
