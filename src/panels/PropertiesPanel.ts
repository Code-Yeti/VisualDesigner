import type { Store } from "@/core/store";
import type { Project, ShapeNode } from "@/core/model";
import type { ViewState } from "@/core/viewState";
import { removeNode, updateNode } from "@/core/mutations";

const PLACEHOLDER = `<h3>Properties</h3><div class="panel-placeholder">Select an object to edit its properties.</div>`;

export function mountPropertiesPanel(
  parent: HTMLElement,
  projectStore: Store<Project>,
  viewStore: Store<ViewState>
): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "side-panel right";
  parent.appendChild(panel);

  function render() {
    const view = viewStore.get();
    const project = projectStore.get();
    const id = view.selectedIds[0];
    const node = id ? project.nodes[id] : undefined;

    if (!node || (node.type !== "rect" && node.type !== "ellipse")) {
      panel.innerHTML = PLACEHOLDER;
      return;
    }
    const shape = node as ShapeNode;
    const fillColor = shape.style.fill.kind === "solid" ? shape.style.fill.color : "#2563eb";

    panel.innerHTML = `
      <h3>Properties</h3>
      <label class="field">Fill<input type="color" id="prop-fill" value="${fillColor}"></label>
      <label class="field">Stroke<input type="color" id="prop-stroke" value="${shape.style.stroke}"></label>
      <label class="field">Stroke width<input type="number" id="prop-stroke-width" min="0" max="40" value="${shape.style.strokeWidth}"></label>
      <label class="field">Opacity<input type="range" id="prop-opacity" min="0" max="1" step="0.05" value="${shape.style.opacity}"></label>
      <button id="prop-delete" class="danger-btn">Delete shape</button>
    `;

    panel.querySelector<HTMLInputElement>("#prop-fill")!.addEventListener("input", (e) => {
      const color = (e.target as HTMLInputElement).value;
      projectStore.update((p) => updateNode(p, shape.id, { style: { ...shape.style, fill: { kind: "solid", color } } }));
    });
    panel.querySelector<HTMLInputElement>("#prop-stroke")!.addEventListener("input", (e) => {
      const color = (e.target as HTMLInputElement).value;
      projectStore.update((p) => updateNode(p, shape.id, { style: { ...shape.style, stroke: color } }));
    });
    panel.querySelector<HTMLInputElement>("#prop-stroke-width")!.addEventListener("input", (e) => {
      const strokeWidth = Number((e.target as HTMLInputElement).value);
      projectStore.update((p) => updateNode(p, shape.id, { style: { ...shape.style, strokeWidth } }));
    });
    panel.querySelector<HTMLInputElement>("#prop-opacity")!.addEventListener("input", (e) => {
      const opacity = Number((e.target as HTMLInputElement).value);
      projectStore.update((p) => updateNode(p, shape.id, { style: { ...shape.style, opacity } }));
    });
    panel.querySelector<HTMLButtonElement>("#prop-delete")!.addEventListener("click", () => {
      projectStore.update((p) => removeNode(p, shape.id));
      viewStore.patch({ ...viewStore.get(), selectedIds: [] });
    });
  }

  projectStore.subscribe(render);
  viewStore.subscribe(render);
  render();
  return panel;
}
