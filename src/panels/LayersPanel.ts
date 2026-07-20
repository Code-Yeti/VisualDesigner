import type { Store } from "@/core/store";
import type { Project } from "@/core/model";
import type { ViewState } from "@/core/viewState";

// Read-only list for now; drag-reorder, lock/hide, and grouping land in M6.
export function mountLayersPanel(parent: HTMLElement, projectStore: Store<Project>, viewStore: Store<ViewState>): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "side-panel left";
  parent.appendChild(panel);

  function render() {
    const project = projectStore.get();
    const selected = new Set(viewStore.get().selectedIds);
    if (project.order.length === 0) {
      panel.innerHTML = `<h3>Layers</h3><div class="panel-placeholder">No objects yet.</div>`;
      return;
    }
    const rows = [...project.order]
      .reverse()
      .map((id) => {
        const node = project.nodes[id];
        if (!node) return "";
        const isSelected = selected.has(id) ? " selected" : "";
        return `<div class="layer-row${isSelected}" data-id="${id}">${node.name ?? node.type}</div>`;
      })
      .join("");
    panel.innerHTML = `<h3>Layers</h3>${rows}`;

    panel.querySelectorAll<HTMLDivElement>(".layer-row").forEach((row) => {
      row.addEventListener("click", () => {
        viewStore.patch({ ...viewStore.get(), selectedIds: [row.dataset.id!] });
      });
    });
  }

  projectStore.subscribe(render);
  viewStore.subscribe(render);
  render();
  return panel;
}
