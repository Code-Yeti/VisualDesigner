import type { Store } from "@/core/store";
import type { ToolId, ViewState } from "@/core/viewState";

export function mountToolbar(parent: HTMLElement, viewStore: Store<ViewState>, onResetView: () => void): HTMLElement {
  const toolbar = document.createElement("div");
  toolbar.className = "app-toolbar";
  toolbar.innerHTML = `
    <span class="brand">VisualDesigner</span>
    <button data-tool="select" title="Select / Move">Select</button>
    <button data-tool="pan" title="Pan (or hold Space)">Pan</button>
    <span class="toolbar-sep"></span>
    <button data-tool="rect" title="Rectangle">Rectangle</button>
    <button data-tool="ellipse" title="Ellipse">Ellipse</button>
    <span class="toolbar-sep"></span>
    <button id="zoom-reset" title="Reset view">100%</button>
  `;
  parent.appendChild(toolbar);

  function refresh() {
    const active = viewStore.get().activeTool;
    toolbar.querySelectorAll<HTMLButtonElement>("button[data-tool]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tool === active);
    });
  }

  toolbar.querySelectorAll<HTMLButtonElement>("button[data-tool]").forEach((btn) => {
    btn.addEventListener("click", () => {
      viewStore.patch({ ...viewStore.get(), activeTool: btn.dataset.tool as ToolId });
    });
  });

  toolbar.querySelector("#zoom-reset")!.addEventListener("click", onResetView);

  viewStore.subscribe(refresh);
  refresh();
  return toolbar;
}
