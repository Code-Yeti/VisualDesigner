import type { Store } from "@/core/store";
import type { Project, ShapeNode } from "@/core/model";
import type { ViewState } from "@/core/viewState";
import { getWorldBBox, handleWorldPos, resolvePortWorldPos, HANDLE_IDS } from "@/core/geometry";
import { svgEl, setAttrs } from "./svgUtil";

const SHAPE_TYPES = new Set(["rect", "ellipse", "polygon", "cloud", "pill", "icon"]);

export function attachSelectionOverlay(
  selectionLayer: SVGGElement,
  projectStore: Store<Project>,
  viewStore: Store<ViewState>
): void {
  function render() {
    selectionLayer.replaceChildren();
    const view = viewStore.get();
    const project = projectStore.get();
    const id = view.selectedIds[0];
    const node = id ? project.nodes[id] : undefined;
    if (!node || !SHAPE_TYPES.has(node.type)) return;

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
    if (!node || !SHAPE_TYPES.has(node.type)) return;

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
