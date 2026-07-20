import type { Store } from "@/core/store";
import type { BoundTextItem, ConnectorNode, Project, RoutingKind, ShapeNode, TextNode } from "@/core/model";
import { defaultFont } from "@/core/model";
import type { ViewState } from "@/core/viewState";
import { removeNode, removeNodeCascade, updateNode } from "@/core/mutations";
import { fontFieldsHtml, bindFontFields } from "./fontFields";

const PLACEHOLDER = `<h3>Properties</h3><div class="panel-placeholder">Select an object to edit its properties.</div>`;
const SHAPE_TYPES = new Set(["rect", "ellipse", "polygon", "cloud", "pill", "icon"]);

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

    if (!node) {
      panel.innerHTML = PLACEHOLDER;
      return;
    }
    if (node.type === "text") {
      renderTextPanel(node as TextNode);
      return;
    }
    if (SHAPE_TYPES.has(node.type)) {
      renderShapePanel(node as ShapeNode);
      return;
    }
    if (node.type === "connector") {
      renderConnectorPanel(node as ConnectorNode);
      return;
    }
    panel.innerHTML = PLACEHOLDER;
  }

  function renderConnectorPanel(connector: ConnectorNode) {
    panel.innerHTML = `
      <h3>Properties</h3>
      <label class="field">Routing
        <select id="conn-routing">
          <option value="straight" ${connector.routing === "straight" ? "selected" : ""}>Straight</option>
          <option value="orthogonal" ${connector.routing === "orthogonal" ? "selected" : ""}>Orthogonal</option>
          <option value="bezier" ${connector.routing === "bezier" ? "selected" : ""}>Bezier</option>
        </select>
      </label>
      <label class="field">Corner radius<input type="number" id="conn-corner" min="0" max="60" value="${connector.cornerRadius}"></label>
      <label class="field">Stub length<input type="number" id="conn-stub" min="0" max="120" value="${connector.stubLength}"></label>
      <label class="field">Stroke width<input type="number" id="conn-width" min="0.5" max="20" step="0.5" value="${connector.style.strokeWidth}"></label>
      <button id="prop-delete" class="danger-btn">Delete connector</button>
    `;

    panel.querySelector<HTMLSelectElement>("#conn-routing")!.addEventListener("change", (e) => {
      const routing = (e.target as HTMLSelectElement).value as RoutingKind;
      projectStore.update((p) => updateNode(p, connector.id, { routing }));
    });
    panel.querySelector<HTMLInputElement>("#conn-corner")!.addEventListener("input", (e) => {
      const cornerRadius = Number((e.target as HTMLInputElement).value);
      projectStore.update((p) => updateNode(p, connector.id, { cornerRadius }));
    });
    panel.querySelector<HTMLInputElement>("#conn-stub")!.addEventListener("input", (e) => {
      const stubLength = Number((e.target as HTMLInputElement).value);
      projectStore.update((p) => updateNode(p, connector.id, { stubLength }));
    });
    panel.querySelector<HTMLInputElement>("#conn-width")!.addEventListener("input", (e) => {
      const strokeWidth = Number((e.target as HTMLInputElement).value);
      projectStore.update((p) => updateNode(p, connector.id, { style: { ...connector.style, strokeWidth } }));
    });
    panel.querySelector<HTMLButtonElement>("#prop-delete")!.addEventListener("click", () => {
      projectStore.update((p) => removeNode(p, connector.id));
      viewStore.patch({ ...viewStore.get(), selectedIds: [] });
    });
  }

  function renderShapePanel(shape: ShapeNode) {
    const fillColor = shape.style.fill.kind === "solid" ? shape.style.fill.color : "#2563eb";

    panel.innerHTML = `
      <h3>Properties</h3>
      <label class="field">Fill<input type="color" id="prop-fill" value="${fillColor}"></label>
      <label class="field">Stroke<input type="color" id="prop-stroke" value="${shape.style.stroke}"></label>
      <label class="field">Stroke width<input type="number" id="prop-stroke-width" min="0" max="40" value="${shape.style.strokeWidth}"></label>
      <label class="field">Opacity<input type="range" id="prop-opacity" min="0" max="1" step="0.05" value="${shape.style.opacity}"></label>
      <button id="prop-delete" class="danger-btn">Delete shape</button>
      <h3 class="section-heading">Text</h3>
      ${boundTextSectionHtml("title", "Title", shape.boundText?.title)}
      ${boundTextSectionHtml("subtitle", "Subtitle", shape.boundText?.subtitle)}
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
      projectStore.update((p) => removeNodeCascade(p, shape.id));
      viewStore.patch({ ...viewStore.get(), selectedIds: [] });
    });

    bindBoundTextSection(shape, "title");
    bindBoundTextSection(shape, "subtitle");
  }

  function boundTextSectionHtml(key: "title" | "subtitle", label: string, item: BoundTextItem | undefined): string {
    if (!item) {
      return `<button id="add-${key}-btn" class="secondary-btn">Add ${label}</button>`;
    }
    return `
      <div class="subsection">
        <label class="field">${label}<input type="text" id="${key}-content" value="${escapeAttr(item.content)}"></label>
        ${fontFieldsHtml(key, item.font, item.fill)}
        <button id="remove-${key}-btn" class="danger-btn">Remove ${label}</button>
      </div>
    `;
  }

  function bindBoundTextSection(shape: ShapeNode, key: "title" | "subtitle") {
    const item = shape.boundText?.[key];
    const addBtn = panel.querySelector<HTMLButtonElement>(`#add-${key}-btn`);
    if (addBtn) {
      addBtn.addEventListener("click", () => {
        const newItem: BoundTextItem = { content: key === "title" ? "Title" : "Subtitle", font: defaultFont(), fill: "#1e293b" };
        if (key === "title") newItem.font.weight = "bold";
        if (key === "subtitle") newItem.font.size = 12;
        projectStore.update((p) => {
          const latest = p.nodes[shape.id] as ShapeNode;
          return updateNode(p, shape.id, { boundText: { ...latest.boundText, [key]: newItem } });
        });
      });
      return;
    }
    if (!item) return;

    panel.querySelector<HTMLInputElement>(`#${key}-content`)!.addEventListener("input", (e) => {
      const content = (e.target as HTMLInputElement).value;
      projectStore.update((p) => {
        const latest = p.nodes[shape.id] as ShapeNode;
        return updateNode(p, shape.id, { boundText: { ...latest.boundText, [key]: { ...latest.boundText![key]!, content } } });
      });
    });
    panel.querySelector<HTMLButtonElement>(`#remove-${key}-btn`)!.addEventListener("click", () => {
      projectStore.update((p) => {
        const latest = p.nodes[shape.id] as ShapeNode;
        const boundText = { ...latest.boundText };
        delete boundText[key];
        return updateNode(p, shape.id, { boundText });
      });
    });
    bindFontFields(
      panel,
      key,
      (patch) => {
        projectStore.update((p) => {
          const latest = p.nodes[shape.id] as ShapeNode;
          const current = latest.boundText![key]!;
          return updateNode(p, shape.id, { boundText: { ...latest.boundText, [key]: { ...current, font: { ...current.font, ...patch } } } });
        });
      },
      (color) => {
        projectStore.update((p) => {
          const latest = p.nodes[shape.id] as ShapeNode;
          const current = latest.boundText![key]!;
          return updateNode(p, shape.id, { boundText: { ...latest.boundText, [key]: { ...current, fill: color } } });
        });
      }
    );
  }

  function renderTextPanel(text: TextNode) {
    panel.innerHTML = `
      <h3>Properties</h3>
      <label class="field">Content<input type="text" id="text-content" value="${escapeAttr(text.content)}"></label>
      ${fontFieldsHtml("text", text.font, text.fill)}
      <button id="prop-delete" class="danger-btn">Delete text</button>
    `;

    panel.querySelector<HTMLInputElement>("#text-content")!.addEventListener("input", (e) => {
      projectStore.update((p) => updateNode(p, text.id, { content: (e.target as HTMLInputElement).value }));
    });
    panel.querySelector<HTMLButtonElement>("#prop-delete")!.addEventListener("click", () => {
      projectStore.update((p) => removeNode(p, text.id));
      viewStore.patch({ ...viewStore.get(), selectedIds: [] });
    });

    bindFontFields(
      panel,
      "text",
      (patch) => {
        projectStore.update((p) => {
          const latest = p.nodes[text.id] as TextNode;
          return updateNode(p, text.id, { font: { ...latest.font, ...patch } });
        });
      },
      (color) => {
        projectStore.update((p) => updateNode(p, text.id, { fill: color }));
      }
    );
  }

  function escapeAttr(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  }

  projectStore.subscribe(render);
  viewStore.subscribe(render);
  render();
  return panel;
}
