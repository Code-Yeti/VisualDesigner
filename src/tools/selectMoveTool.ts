import type { Store } from "@/core/store";
import type { NodeId, Project } from "@/core/model";
import type { ViewState } from "@/core/viewState";
import { clientToWorld } from "./coords";
import { updateNode } from "@/core/mutations";

/**
 * Handles both selecting a node (click) and moving it (drag), since in
 * practice those are one gesture in a diagram editor's "select" tool.
 */
export function attachSelectMoveTool(
  container: HTMLElement,
  projectStore: Store<Project>,
  viewStore: Store<ViewState>
): void {
  let dragging = false;
  let dragId: NodeId | null = null;
  let startWorld = { x: 0, y: 0 };
  let startNode = { x: 0, y: 0 };

  container.addEventListener("pointerdown", (e) => {
    if (viewStore.get().activeTool !== "select") return;
    const targetEl = (e.target as Element).closest?.("[data-id]");
    const world = clientToWorld(e.clientX, e.clientY, container, viewStore.get());

    if (!targetEl) {
      viewStore.patch({ ...viewStore.get(), selectedIds: [] });
      return;
    }

    const id = targetEl.getAttribute("data-id")!;
    const node = projectStore.get().nodes[id];
    if (!node) return;

    viewStore.patch({ ...viewStore.get(), selectedIds: [id] });

    if (node.type !== "connector" && node.type !== "group") {
      dragging = true;
      dragId = id;
      startWorld = world;
      startNode = { x: node.transform.x, y: node.transform.y };
      container.setPointerCapture(e.pointerId);
    }
    e.stopPropagation();
  });

  container.addEventListener("pointermove", (e) => {
    if (!dragging || !dragId) return;
    const world = clientToWorld(e.clientX, e.clientY, container, viewStore.get());
    const dx = world.x - startWorld.x;
    const dy = world.y - startWorld.y;
    projectStore.update((p) => {
      const node = p.nodes[dragId!];
      if (!node) return p;
      return updateNode(p, dragId!, {
        transform: { ...node.transform, x: startNode.x + dx, y: startNode.y + dy },
      });
    });
  });

  function endDrag(e: PointerEvent) {
    if (!dragging) return;
    dragging = false;
    dragId = null;
    container.releasePointerCapture(e.pointerId);
  }
  container.addEventListener("pointerup", endDrag);
  container.addEventListener("pointercancel", endDrag);
}
