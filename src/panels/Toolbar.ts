import type { Store } from "@/core/store";
import type { ToolId, ViewState } from "@/core/viewState";
import { ICON_PRESETS } from "@/core/presets";

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
    <button data-tool="polygon" title="Polygon (click points, double-click to finish)">Polygon</button>
    <button data-tool="cloud" title="Cloud">Cloud</button>
    <button data-tool="pill" title="Pill / Badge">Pill</button>
    <button data-tool="text" title="Text">Text</button>
    <span class="toolbar-sep"></span>
    <select id="icon-select" title="Insert icon (then drag on the canvas)">
      <option value="">Icon…</option>
      ${ICON_PRESETS.map((p) => `<option value="${p.key}">${p.label}</option>`).join("")}
    </select>
    <span class="toolbar-sep"></span>
    <button id="zoom-reset" title="Reset view">100%</button>
  `;
  parent.appendChild(toolbar);

  function refresh() {
    const view = viewStore.get();
    toolbar.querySelectorAll<HTMLButtonElement>("button[data-tool]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tool === view.activeTool);
    });
    const iconSelect = toolbar.querySelector<HTMLSelectElement>("#icon-select")!;
    iconSelect.classList.toggle("active", view.activeTool === "icon");
    if (view.activeTool !== "icon") iconSelect.value = "";
  }

  toolbar.querySelectorAll<HTMLButtonElement>("button[data-tool]").forEach((btn) => {
    btn.addEventListener("click", () => {
      viewStore.patch({ ...viewStore.get(), activeTool: btn.dataset.tool as ToolId });
    });
  });

  toolbar.querySelector<HTMLSelectElement>("#icon-select")!.addEventListener("change", (e) => {
    const key = (e.target as HTMLSelectElement).value;
    if (!key) return;
    viewStore.patch({ ...viewStore.get(), activeTool: "icon", activeIconKey: key });
  });

  toolbar.querySelector("#zoom-reset")!.addEventListener("click", onResetView);

  viewStore.subscribe(refresh);
  refresh();
  return toolbar;
}
