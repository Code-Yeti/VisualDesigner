import type { Store } from "@/core/store";
import type { NodeId, Project } from "@/core/model";
import type { ViewState } from "@/core/viewState";
import { bringForward, bringToFront, reorderNode, sendBackward, sendToBack, updateNode } from "@/core/mutations";

export function mountLayersPanel(parent: HTMLElement, projectStore: Store<Project>, viewStore: Store<ViewState>): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "side-panel left";
  parent.appendChild(panel);

  let draggingId: NodeId | null = null;

  function render() {
    const project = projectStore.get();
    const selected = new Set(viewStore.get().selectedIds);
    // Only top-level items: a grouped child is represented by its group's row, not its own.
    const topLevelIds = project.order.filter((id) => project.nodes[id]?.parentId === null);

    if (topLevelIds.length === 0) {
      panel.innerHTML = `<h3>Layers</h3><div class="panel-placeholder">No objects yet.</div>`;
      return;
    }

    const rows = [...topLevelIds]
      .reverse()
      .map((id) => {
        const node = project.nodes[id];
        if (!node) return "";
        const isSelected = selected.has(id) ? " selected" : "";
        const label = node.name ?? node.type;
        const locked = node.locked ?? false;
        const hidden = node.visible === false;
        return `
          <div class="layer-row${isSelected}" data-id="${id}">
            <span class="layer-drag-handle" title="Drag to reorder">&#8942;&#8942;</span>
            <span class="layer-name">${label}</span>
            <span class="layer-actions">
              <button class="layer-icon-btn" data-action="front" title="Bring to front">&#8607;</button>
              <button class="layer-icon-btn" data-action="forward" title="Bring forward">&#9650;</button>
              <button class="layer-icon-btn" data-action="backward" title="Send backward">&#9660;</button>
              <button class="layer-icon-btn" data-action="back" title="Send to back">&#8609;</button>
              <button class="layer-icon-btn" data-action="hide" title="${hidden ? "Show" : "Hide"}">${hidden ? "&#128584;" : "&#128065;"}</button>
              <button class="layer-icon-btn" data-action="lock" title="${locked ? "Unlock" : "Lock"}">${locked ? "&#128274;" : "&#128275;"}</button>
            </span>
          </div>`;
      })
      .join("");

    panel.innerHTML = `<h3>Layers</h3>${rows}`;

    panel.querySelectorAll<HTMLDivElement>(".layer-row").forEach((row) => {
      const id = row.dataset.id!;

      row.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).closest("[data-action], .layer-drag-handle")) return;
        viewStore.patch({ ...viewStore.get(), selectedIds: [id] });
      });

      row.querySelector<HTMLElement>('[data-action="front"]')!.addEventListener("click", () => {
        projectStore.update((p) => bringToFront(p, id));
      });
      row.querySelector<HTMLElement>('[data-action="forward"]')!.addEventListener("click", () => {
        projectStore.update((p) => bringForward(p, id));
      });
      row.querySelector<HTMLElement>('[data-action="backward"]')!.addEventListener("click", () => {
        projectStore.update((p) => sendBackward(p, id));
      });
      row.querySelector<HTMLElement>('[data-action="back"]')!.addEventListener("click", () => {
        projectStore.update((p) => sendToBack(p, id));
      });
      row.querySelector<HTMLElement>('[data-action="hide"]')!.addEventListener("click", () => {
        const node = projectStore.get().nodes[id];
        projectStore.update((p) => updateNode(p, id, { visible: node?.visible === false ? true : false }));
      });
      row.querySelector<HTMLElement>('[data-action="lock"]')!.addEventListener("click", () => {
        const node = projectStore.get().nodes[id];
        projectStore.update((p) => updateNode(p, id, { locked: !node?.locked }));
      });

      const handle = row.querySelector<HTMLElement>(".layer-drag-handle")!;
      handle.addEventListener("pointerdown", (e) => {
        draggingId = id;
        row.classList.add("dragging");
        e.preventDefault();
      });
    });
  }

  panel.addEventListener("pointermove", (e) => {
    if (!draggingId) return;
    panel.querySelectorAll(".layer-row").forEach((r) => r.classList.remove("drop-target"));
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>(".layer-row");
    if (target && target.dataset.id !== draggingId) target.classList.add("drop-target");
  });

  window.addEventListener("pointerup", (e) => {
    if (!draggingId) return;
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>(".layer-row");
    panel.querySelectorAll(".layer-row").forEach((r) => r.classList.remove("dragging", "drop-target"));
    if (target && target.dataset.id && target.dataset.id !== draggingId) {
      const targetId = target.dataset.id;
      const movedId = draggingId;
      projectStore.update((p) => reorderNode(p, movedId, p.order.indexOf(targetId)));
    }
    draggingId = null;
  });

  projectStore.subscribe(render);
  viewStore.subscribe(render);
  render();
  return panel;
}
