import type { HistoryStore } from "@/core/historyStore";
import type { Store } from "@/core/store";
import type { NodeId, ShapeNode, TextNode } from "@/core/model";
import type { ViewState } from "@/core/viewState";
import { clientToWorld } from "./coords";
import {
  computeResizedBBox,
  getTextWorldBBox,
  getWorldBBox,
  resizeGeometry,
  resizeTextFontSize,
  snapValue,
  type BBox,
  type HandleId,
} from "@/core/geometry";

export function attachResizeTool(
  container: HTMLElement,
  selectionLayer: SVGGElement,
  projectStore: HistoryStore,
  viewStore: Store<ViewState>
): void {
  let activeId: NodeId | null = null;
  let handle: HandleId | null = null;
  let startWorld = { x: 0, y: 0 };
  let startBBox: BBox = { x: 0, y: 0, width: 0, height: 0 };

  selectionLayer.addEventListener("pointerdown", (e) => {
    const target = e.target as SVGElement;
    const h = target.getAttribute?.("data-handle") as HandleId | null;
    if (!h) return;

    const id = viewStore.get().selectedIds[0];
    const node = id ? projectStore.get().nodes[id] : undefined;
    if (!node || (node.type !== "text" && !("geometry" in node))) return;

    activeId = id;
    handle = h;
    startWorld = clientToWorld(e.clientX, e.clientY, container, viewStore.get());
    startBBox = node.type === "text" ? getTextWorldBBox(node as TextNode) : getWorldBBox(node as ShapeNode);
    projectStore.beginGesture();
    container.setPointerCapture(e.pointerId);
    e.stopPropagation();
  });

  container.addEventListener("pointermove", (e) => {
    if (!activeId || !handle) return;
    const world = clientToWorld(e.clientX, e.clientY, container, viewStore.get());
    const dx = world.x - startWorld.x;
    const dy = world.y - startWorld.y;
    let next = computeResizedBBox(startBBox, handle, dx, dy);

    const { canvas } = projectStore.get();
    if (canvas.snapEnabled) {
      // Only snap the edge(s) the current handle actually drags - e.g. an
      // "e" handle only moves the right edge, so left/top stay untouched.
      const gridSize = canvas.gridSize;
      const x = handle.includes("w") ? snapValue(next.x, gridSize) : next.x;
      const y = handle.includes("n") ? snapValue(next.y, gridSize) : next.y;
      const right = handle.includes("e") ? snapValue(next.x + next.width, gridSize) : next.x + next.width;
      const bottom = handle.includes("s") ? snapValue(next.y + next.height, gridSize) : next.y + next.height;
      next = { x, y, width: Math.max(8, right - x), height: Math.max(8, bottom - y) };
    }

    projectStore.update((p) => {
      const node = p.nodes[activeId!];
      if (!node) return p;

      if (node.type === "text") {
        const result = resizeTextFontSize(node as TextNode, handle!, startBBox, next);
        return {
          ...p,
          nodes: {
            ...p.nodes,
            [activeId!]: {
              ...node,
              transform: { ...node.transform, x: result.x, y: result.y },
              font: { ...(node as TextNode).font, size: result.fontSize },
            },
          },
        };
      }

      const shape = node as ShapeNode;
      const geometry = resizeGeometry(shape.geometry, startBBox, next);
      return {
        ...p,
        nodes: {
          ...p.nodes,
          [activeId!]: {
            ...shape,
            transform: { ...shape.transform, x: next.x, y: next.y },
            geometry,
          },
        },
      };
    });
  });

  function end(e: PointerEvent) {
    if (!activeId) return;
    activeId = null;
    handle = null;
    projectStore.endGesture();
    container.releasePointerCapture(e.pointerId);
  }
  container.addEventListener("pointerup", end);
  container.addEventListener("pointercancel", end);
}
