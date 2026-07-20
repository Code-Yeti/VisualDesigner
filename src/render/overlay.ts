import type { Store } from "@/core/store";
import type { BBox } from "@/core/geometry";
import type { ConnectorNode, Project, ShapeNode, TextNode } from "@/core/model";
import { SHAPE_NODE_TYPES } from "@/core/model";
import type { ViewState } from "@/core/viewState";
import {
  getWorldBBox,
  getGroupWorldBBox,
  getTextWorldBBox,
  handleWorldPos,
  resolveConnectorEndpoints,
  resolvePortWorldPos,
  HANDLE_IDS,
} from "@/core/geometry";
import { getBezierHandlePoints, getOrthogonalBendPoints } from "@/core/routing";
import { svgEl, setAttrs } from "./svgUtil";

function unionBBox(a: BBox, b: BBox): BBox {
  const minX = Math.min(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxX = Math.max(a.x + a.width, b.x + b.width);
  const maxY = Math.max(a.y + a.height, b.y + b.height);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Bbox for whichever node types a selection outline/handles can be drawn for - shapes, text, and (outline only) groups. */
function selectableBBox(project: Project, id: string): BBox | null {
  const node = project.nodes[id];
  if (!node) return null;
  if (node.type === "group") return getGroupWorldBBox(project, id);
  if (node.type === "text") return getTextWorldBBox(node as TextNode);
  if (SHAPE_NODE_TYPES.has(node.type)) return getWorldBBox(node as ShapeNode);
  return null;
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
        const bbox = selectableBBox(project, id);
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
    const bbox = selectableBBox(project, id);
    if (!bbox) return;

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

/**
 * Draws draggable control-point handles for the single selected connector -
 * bend-point handles for orthogonal routing (`getOrthogonalBendPoints`,
 * always at least one: the auto elbow if no waypoints have been placed yet),
 * or the two bezier control-point handles with guide lines to their anchors
 * (`getBezierHandlePoints`). Straight connectors have nothing to control, so
 * nothing is drawn for them. `connectorHandleTool.ts` listens on this same
 * layer for drag/double-click interactions.
 */
export function attachConnectorHandlesOverlay(handlesLayer: SVGGElement, projectStore: Store<Project>, viewStore: Store<ViewState>): void {
  function render() {
    handlesLayer.replaceChildren();
    const view = viewStore.get();
    if (view.selectedIds.length !== 1) return;
    const project = projectStore.get();
    const node = project.nodes[view.selectedIds[0]];
    if (!node || node.type !== "connector") return;
    const connector = node as ConnectorNode;
    if (connector.routing === "straight") return;

    const endpoints = resolveConnectorEndpoints(project, connector);
    if (!endpoints) return;
    const { sourcePos, sourceSide, targetPos, targetSide } = endpoints;
    const size = 6 / view.zoom;

    if (connector.routing === "bezier") {
      const { c1, c2 } = getBezierHandlePoints(sourcePos, sourceSide, targetPos, targetSide, {
        routing: "bezier",
        cornerRadius: connector.cornerRadius,
        stubLength: connector.stubLength,
        bezierControls: connector.bezierControls,
      });
      handlesLayer.appendChild(svgEl("line", { x1: sourcePos.x, y1: sourcePos.y, x2: c1.x, y2: c1.y, class: "bezier-guide" }));
      handlesLayer.appendChild(svgEl("line", { x1: targetPos.x, y1: targetPos.y, x2: c2.x, y2: c2.y, class: "bezier-guide" }));
      for (const [key, pt] of [["c1", c1] as const, ["c2", c2] as const]) {
        const circle = svgEl("circle", { cx: pt.x, cy: pt.y, r: size, class: "connector-handle", "data-bezier-handle": key });
        setAttrs(circle, { "pointer-events": "all" });
        handlesLayer.appendChild(circle);
      }
      return;
    }

    const bends = getOrthogonalBendPoints(sourcePos, sourceSide, targetPos, targetSide, {
      routing: "orthogonal",
      cornerRadius: connector.cornerRadius,
      stubLength: connector.stubLength,
      waypoints: connector.waypoints,
    });
    bends.forEach((pt, index) => {
      const circle = svgEl("circle", { cx: pt.x, cy: pt.y, r: size, class: "connector-handle", "data-waypoint-index": index });
      setAttrs(circle, { "pointer-events": "all" });
      handlesLayer.appendChild(circle);
    });
  }

  projectStore.subscribe(render);
  viewStore.subscribe(render);
  render();
}
