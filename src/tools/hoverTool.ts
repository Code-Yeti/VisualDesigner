import type { Store } from "@/core/store";
import type { Project } from "@/core/model";
import { SHAPE_NODE_TYPES } from "@/core/model";
import type { ViewState } from "@/core/viewState";

/** Tracks which shape is under the pointer so ports can be revealed on hover. */
export function attachHoverTool(container: HTMLElement, projectStore: Store<Project>, viewStore: Store<ViewState>): void {
  function setHovered(id: string | null) {
    if (viewStore.get().hoveredShapeId !== id) {
      viewStore.patch({ ...viewStore.get(), hoveredShapeId: id });
    }
  }

  container.addEventListener("pointermove", (e) => {
    const target = document.elementFromPoint(e.clientX, e.clientY);
    // A port marker sits in the overlay (on top of the stage) and isn't
    // inside a [data-id] element, so resolve it via data-shape-id instead -
    // otherwise hovering a port would hide the very ports being interacted with.
    const portEl = target?.closest("[data-port-id]");
    const nodeEl = portEl ?? target?.closest("[data-id]");
    const id = portEl?.getAttribute("data-shape-id") ?? nodeEl?.getAttribute("data-id") ?? null;
    const node = id ? projectStore.get().nodes[id] : undefined;
    setHovered(node && SHAPE_NODE_TYPES.has(node.type) ? id : null);
  });

  container.addEventListener("pointerleave", () => setHovered(null));
}
