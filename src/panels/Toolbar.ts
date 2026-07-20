import type { Store } from "@/core/store";
import type { HistoryStore } from "@/core/historyStore";
import type { ToolId, ViewState } from "@/core/viewState";
import { ICON_PRESETS } from "@/core/presets";

export interface ToolbarActions {
  onResetView: () => void;
  onSave: () => void;
  onLoad: () => void;
}

export function mountToolbar(
  parent: HTMLElement,
  viewStore: Store<ViewState>,
  historyStore: HistoryStore,
  actions: ToolbarActions
): HTMLElement {
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
    <button data-tool="connect" title="Connect (drag between shapes)">Connect</button>
    <span class="toolbar-sep"></span>
    <select id="icon-select" title="Insert icon (then drag on the canvas)">
      <option value="">Icon…</option>
      ${ICON_PRESETS.map((p) => `<option value="${p.key}">${p.label}</option>`).join("")}
    </select>
    <span class="toolbar-sep"></span>
    <button id="undo-btn" title="Undo (Ctrl+Z)">&#8630;</button>
    <button id="redo-btn" title="Redo (Ctrl+Y)">&#8631;</button>
    <span class="toolbar-sep"></span>
    <button id="zoom-reset" title="Reset view">100%</button>
    <span class="toolbar-sep"></span>
    <button id="save-btn" title="Save project to a .json file">Save</button>
    <button id="load-btn" title="Load project from a .json file">Load</button>
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
    toolbar.querySelector<HTMLButtonElement>("#undo-btn")!.disabled = !historyStore.canUndo();
    toolbar.querySelector<HTMLButtonElement>("#redo-btn")!.disabled = !historyStore.canRedo();
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

  toolbar.querySelector("#zoom-reset")!.addEventListener("click", actions.onResetView);
  toolbar.querySelector("#save-btn")!.addEventListener("click", actions.onSave);
  toolbar.querySelector("#load-btn")!.addEventListener("click", actions.onLoad);
  toolbar.querySelector("#undo-btn")!.addEventListener("click", () => historyStore.undo());
  toolbar.querySelector("#redo-btn")!.addEventListener("click", () => historyStore.redo());

  viewStore.subscribe(refresh);
  historyStore.subscribe(refresh);
  refresh();
  return toolbar;
}
