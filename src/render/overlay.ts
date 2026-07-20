import type { Store } from "@/core/store";
import type { BBox } from "@/core/geometry";
import type { Project, ShapeNode } from "@/core/model";
import { SHAPE_NODE_TYPES } from "@/core/model";
import type { ViewState } from "@/core/viewState";
import { getWorldBBox, getGroupWorldBBox, handleWorldPos, resolvePortWorldPos, HANDLE_IDS } from "@/core/geometry";
import { svgEl, setAttrs } from "./svgUtil";

function unionBBox(a: BBox, b: BBox): BBox {
  const minX = Math.min(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxX = Math.max(a.x + a.width, b.x + b.width);
  const maxY = Math.max(a.y + a.height, b.y + b.height);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Pure UI chrome, drawn only in the overlay SVG - export code (M9) never touches this layer, so the grid can never leak into an exported file. */
export function attachGridOverlay(gridLayer: SVGGElement, projectStore: Store<Project>): void {
  function render() {
    gridLayer.replaceChildren();
    const { canvas } = projectStore.get();
    if (!canvas.gridVisible) return;
    const step = canvas.gridSize;
    if (step <= 0) return;

    for (let x = 0; x <= canvas.width; x += step) {
      gridLayer.appendChild(svgEl("line", { x1: x, y1: 0, x2: x, y2: canvas.height, class: "grid-line" }));
    }
    for (let y = 0; y <= canvas.height; y += step) {
      gridLayer.appendChild(svgEl("line", { x1: 0, y1: y, x2: canvas.width, y2: y, class: "grid-line" }));
    }
  }

  projectStore.subscribe(render);
  render();
}

export function attachSelectionOverlay(
  selectionLayer: SVGGElement,
  projectStore: Store<Project>,
  viewStore: Store<ViewState>
): void {
  function render() {
    selectionLayer.replaceChildren();
    const view = viewStore.get();
    const project = projectStore.get();
    const ids = view.selectedIds;
    if (ids.length === 0) return;

    // Multi-select: draw each member's outline plus one dashed union bbox; no resize handles (deferred to M11).
    if (ids.length > 1) {
      let union: BBox | null = null;
      for (const id of ids) {
        const node = project.nodes[id];
        const bbox = node && node.type === "group" ? getGroupWorldBBox(project, id) : node && SHAPE_NODE_TYPES.has(node.type) ? getWorldBBox(node as ShapeNode) : null;
        if (!bbox) continue;
        selectionLayer.appendChild(svgEl("rect", { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height, class: "selection-outline" }));
        union = union ? unionBBox(union, bbox) : bbox;
      }
      if (union) {
        selectionLayer.appendChild(
          svgEl("rect", { x: union.x - 6, y: union.y - 6, width: union.width + 12, height: union.height + 12, class: "selection-union-outline" })
        );
      }
      return;
    }

    const id = ids[0];
    const node = project.nodes[id];
    if (!node) return;

    if (node.type === "group") {
      const bbox = getGroupWorldBBox(project, id);
      if (!bbox) return;
      selectionLayer.appendChild(svgEl("rect", { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height, class: "selection-outline" }));
      return; // groups aren't resizable in v1
    }
    if (!SHAPE_NODE_TYPES.has(node.type)) return;

    const bbox = getWorldBBox(node as ShapeNode);
    const outline = svgEl("rect", {
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height,
      class: "selection-outline",
    });
    selectionLayer.appendChild(outline);

    const size = 8 / view.zoom;
    for (const handle of HANDLE_IDS) {
      const pos = handleWorldPos(bbox, handle);
      const rect = svgEl("rect", {
        x: pos.x - size / 2,
        y: pos.y - size / 2,
        width: size,
        height: size,
        class: "selection-handle",
        "data-handle": handle,
      });
      setAttrs(rect, { "pointer-events": "all" });
      selectionLayer.appendChild(rect);
    }
  }

  projectStore.subscribe(render);
  viewStore.subscribe(render);
  render();
}

/** Shows the hovered shape's ports; ports are only clickable while the connect tool is active. */
export function attachPortsOverlay(portsLayer: SVGGElement, projectStore: Store<Project>, viewStore: Store<ViewState>): void {
  function render() {
    portsLayer.replaceChildren();
    const view = viewStore.get();
    const id = view.hoveredShapeId;
    if (!id) return;
    const node = projectStore.get().nodes[id];
    if (!node || !SHAPE_NODE_TYPES.has(node.type)) return;

    const shape = node as ShapeNode;
    const interactive = view.activeTool === "connect";
    const r = 6 / view.zoom;

    for (const port of shape.ports) {
      const pos = resolvePortWorldPos(shape, port);
      const circle = svgEl("circle", {
        cx: pos.x,
        cy: pos.y,
        r,
        class: "port-marker",
        "data-shape-id": shape.id,
        "data-port-id": port.id,
      });
      setAttrs(circle, { "pointer-events": interactive ? "all" : "none" });
      portsLayer.appendChild(circle);
    }
  }

  projectStore.subscribe(render);
  viewStore.subscribe(render);
  render();
}
