import type { Store } from "@/core/store";
import type { NodeId, Project } from "@/core/model";
import type { ViewState } from "@/core/viewState";
import { clientToWorld } from "./coords";
import { getGroupDescendantIds, resolveSelectionRoot, updateNode } from "@/core/mutations";

/**
 * Handles both selecting a node (click, shift-click to add/remove) and
 * moving it (drag), since in practice those are one gesture in a diagram
 * editor's "select" tool. Clicking any member of a group resolves to the
 * whole group; dragging a group (or a multi-selection) moves every
 * descendant shape by the same delta, since groups have no geometry of
 * their own.
 */
export function attachSelectMoveTool(container: HTMLElement, projectStore: Store<Project>, viewStore: Store<ViewState>): void {
  let dragging = false;
  let dragIds: NodeId[] = [];
  let startWorld = { x: 0, y: 0 };
  let startPositions = new Map<NodeId, { x: number; y: number }>();

  container.addEventListener("pointerdown", (e) => {
    if (viewStore.get().activeTool !== "select") return;
    const targetEl = (e.target as Element).closest?.("[data-id]");
    const world = clientToWorld(e.clientX, e.clientY, container, viewStore.get());
    const view = viewStore.get();

    if (!targetEl) {
      if (!e.shiftKey) viewStore.patch({ ...view, selectedIds: [] });
      return;
    }

    const project = projectStore.get();
    const rawId = targetEl.getAttribute("data-id")!;
    const id = resolveSelectionRoot(project, rawId);
    const node = project.nodes[id];
    if (!node || node.locked) return;

    let selected: NodeId[];
    if (e.shiftKey) {
      selected = view.selectedIds.includes(id) ? view.selectedIds.filter((x) => x !== id) : [...view.selectedIds, id];
    } else if (view.selectedIds.includes(id)) {
      selected = view.selectedIds; // keep existing multi-selection so the whole set can be dragged together
    } else {
      selected = [id];
    }
    viewStore.patch({ ...view, selectedIds: selected });

    if (node.type !== "connector" && selected.includes(id)) {
      const moveIds = new Set<NodeId>();
      for (const sid of selected) {
        const snode = project.nodes[sid];
        if (!snode || snode.type === "connector" || snode.locked) continue;
        for (const leafId of getGroupDescendantIds(project, sid)) moveIds.add(leafId);
      }
      startPositions = new Map();
      for (const mid of moveIds) {
        const mnode = project.nodes[mid];
        if (mnode) startPositions.set(mid, { x: mnode.transform.x, y: mnode.transform.y });
      }
      dragIds = [...moveIds];
      dragging = dragIds.length > 0;
      startWorld = world;
      container.setPointerCapture(e.pointerId);
    }
    e.stopPropagation();
  });

  container.addEventListener("pointermove", (e) => {
    if (!dragging || dragIds.length === 0) return;
    const world = clientToWorld(e.clientX, e.clientY, container, viewStore.get());
    const dx = world.x - startWorld.x;
    const dy = world.y - startWorld.y;
    projectStore.update((p) => {
      let next = p;
      for (const id of dragIds) {
        const start = startPositions.get(id);
        const node = next.nodes[id];
        if (!start || !node) continue;
        next = updateNode(next, id, { transform: { ...node.transform, x: start.x + dx, y: start.y + dy } });
      }
      return next;
    });
  });

  function endDrag(e: PointerEvent) {
    if (!dragging) return;
    dragging = false;
    dragIds = [];
    container.releasePointerCapture(e.pointerId);
  }
  container.addEventListener("pointerup", endDrag);
  container.addEventListener("pointercancel", endDrag);
}
