import type { Store } from "@/core/store";
import type { NodeId, Project, ShapeNode } from "@/core/model";
import type { ViewState } from "@/core/viewState";
import { clientToWorld } from "./coords";
import { computeResizedBBox, getWorldBBox, type BBox, type HandleId } from "@/core/geometry";

export function attachResizeTool(
  container: HTMLElement,
  selectionLayer: SVGGElement,
  projectStore: Store<Project>,
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
    const node = id ? (projectStore.get().nodes[id] as ShapeNode | undefined) : undefined;
    if (!node) return;

    activeId = id;
    handle = h;
    startWorld = clientToWorld(e.clientX, e.clientY, container, viewStore.get());
    startBBox = getWorldBBox(node);
    container.setPointerCapture(e.pointerId);
    e.stopPropagation();
  });

  container.addEventListener("pointermove", (e) => {
    if (!activeId || !handle) return;
    const world = clientToWorld(e.clientX, e.clientY, container, viewStore.get());
    const dx = world.x - startWorld.x;
    const dy = world.y - startWorld.y;
    const next = computeResizedBBox(startBBox, handle, dx, dy);

    projectStore.update((p) => {
      const node = p.nodes[activeId!] as ShapeNode | undefined;
      if (!node) return p;
      const geometry =
        node.geometry.kind === "ellipse"
          ? { ...node.geometry, rx: next.width / 2, ry: next.height / 2 }
          : node.geometry.kind === "rect"
          ? { ...node.geometry, width: next.width, height: next.height }
          : node.geometry;
      return {
        ...p,
        nodes: {
          ...p.nodes,
          [activeId!]: {
            ...node,
            transform: { ...node.transform, x: next.x, y: next.y },
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
    container.releasePointerCapture(e.pointerId);
  }
  container.addEventListener("pointerup", end);
  container.addEventListener("pointercancel", end);
}
