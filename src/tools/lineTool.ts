import type { Store } from "@/core/store";
import type { ConnectorNode, Project } from "@/core/model";
import { defaultTransform } from "@/core/model";
import type { ViewState } from "@/core/viewState";
import { clientToWorld } from "./coords";
import { nextId } from "@/core/ids";
import { addNode } from "@/core/mutations";
import { snapValue } from "@/core/geometry";
import { svgEl, setAttrs } from "@/render/svgUtil";

const DEFAULT_MARKER_SIZE = 12;
const MIN_DRAG_DISTANCE = 4;
const DEFAULT_LENGTH = 120; // used for a plain click with no drag, matching drawShapeTool's click-to-place-default convention

interface DragState {
  start: { x: number; y: number };
  previewEl: SVGLineElement;
}

/**
 * Draws a standalone line: a connector (same ConnectorNode type, same
 * ConnectorStyle/markers/routing/waypoints/bezierControls, same Properties
 * panel) whose two endpoints are free points instead of `{nodeId, portId}`
 * - see `isFreeLine` in core/model.ts. Unlike the Connect tool, it never
 * snaps to a shape's ports; the ends stay free to drag anywhere
 * (`connectorHandleTool.ts`'s endpoint-drag handles), and the whole line can
 * be repositioned by dragging its body (`selectMoveTool.ts`).
 */
export function attachLineTool(
  container: HTMLElement,
  draftLayer: SVGGElement,
  projectStore: Store<Project>,
  viewStore: Store<ViewState>
): void {
  let drag: DragState | null = null;

  function isActive() {
    return viewStore.get().activeTool === "line";
  }

  function snapped(pt: { x: number; y: number }): { x: number; y: number } {
    const { canvas } = projectStore.get();
    if (!canvas.snapEnabled) return pt;
    return { x: snapValue(pt.x, canvas.gridSize), y: snapValue(pt.y, canvas.gridSize) };
  }

  container.addEventListener("pointerdown", (e) => {
    if (!isActive()) return;
    const start = snapped(clientToWorld(e.clientX, e.clientY, container, viewStore.get()));

    const previewEl = svgEl("line", { x1: start.x, y1: start.y, x2: start.x, y2: start.y, class: "connector-draft" });
    draftLayer.appendChild(previewEl);
    drag = { start, previewEl };
    container.setPointerCapture(e.pointerId);
    e.stopPropagation();
  });

  container.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const world = snapped(clientToWorld(e.clientX, e.clientY, container, viewStore.get()));
    setAttrs(drag.previewEl, { x2: world.x, y2: world.y });
  });

  function finish(e: PointerEvent) {
    if (!drag) return;
    const world = snapped(clientToWorld(e.clientX, e.clientY, container, viewStore.get()));
    drag.previewEl.remove();
    container.releasePointerCapture(e.pointerId);
    const { start } = drag;
    drag = null;

    const dragDistance = Math.hypot(world.x - start.x, world.y - start.y);
    const end = dragDistance < MIN_DRAG_DISTANCE ? { x: start.x + DEFAULT_LENGTH, y: start.y } : world;

    const id = nextId("connector");
    const line: ConnectorNode = {
      id,
      type: "connector",
      name: "Line",
      parentId: null,
      visible: true,
      transform: defaultTransform(),
      source: start,
      target: end,
      routing: "straight",
      cornerRadius: 12,
      stubLength: 24,
      style: {
        stroke: { kind: "solid", color: "#475569" },
        strokeWidth: 2.5,
        dash: "solid",
        dashLength: 8,
        dashRounded: false,
        animated: false,
        animationSeconds: 1,
      },
      // No arrowheads by default - a plain line, not an implied direction like the Connect tool's default.
      markers: { start: "none", end: "none", size: DEFAULT_MARKER_SIZE },
    };
    projectStore.update((p) => addNode(p, line));
    viewStore.patch({ ...viewStore.get(), activeTool: "select", selectedIds: [id] });
  }

  container.addEventListener("pointerup", finish);
  container.addEventListener("pointercancel", () => {
    if (!drag) return;
    drag.previewEl.remove();
    drag = null;
  });
}
