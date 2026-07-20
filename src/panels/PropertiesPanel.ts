import type { Store } from "@/core/store";
import type { BoundTextItem, ConnectorNode, ConnectorStyle, DashKind, FilterDef, MarkerType, Project, RoutingKind, ShapeNode, ShapeStyle, TextNode } from "@/core/model";
import { defaultDropShadowFilter, defaultFont, SHAPE_NODE_TYPES } from "@/core/model";
import type { ViewState } from "@/core/viewState";
import { groupNodes, removeNode, removeNodeCascade, ungroupNode, updateNode, upsertFilterDef, upsertGradientDef } from "@/core/mutations";
import { alignNodes, distributeNodes, type AlignMode } from "@/core/align";
import { nextId } from "@/core/ids";
import { fontFieldsHtml, bindFontFields } from "./fontFields";
import { renderCanvasSettings } from "./CanvasSettingsPanel";
import { effectsFieldsHtml, bindEffectsFields } from "./effectsFields";
import { openImageFilePicker } from "@/io/imageFilePicker";

const MARKER_OPTIONS: { value: MarkerType; label: string }[] = [
  { value: "none", label: "None" },
  { value: "arrow", label: "Arrow" },
  { value: "openArrow", label: "Open arrow" },
  { value: "circle", label: "Circle" },
  { value: "diamond", label: "Diamond" },
];

const PLACEHOLDER = `<h3>Properties</h3><div class="panel-placeholder">Select an object to edit its properties.</div>`;

export function mountPropertiesPanel(
  parent: HTMLElement,
  projectStore: Store<Project>,
  viewStore: Store<ViewState>,
  onResetBoard: () => void
): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "side-panel right";
  parent.appendChild(panel);

  // Always re-fetch the node from the store inside the mutator instead of
  // merging onto a `shape`/`connector` object captured by the outer render()
  // closure. That closure is stale as soon as ANY field changes without a
  // full panel rebuild in between (which is normal: our anti-flicker guard
  // intentionally skips rebuilding while focus stays inside this panel, e.g.
  // moving from one color picker to the next) - merging onto the stale copy
  // would silently revert whatever the previous field just changed.
  function updateShapeStyle(id: string, patch: Partial<ShapeStyle>) {
    projectStore.update((p) => {
      const current = p.nodes[id] as ShapeNode | undefined;
      if (!current) return p;
      return updateNode(p, id, { style: { ...current.style, ...patch } });
    });
  }

  function updateConnectorStyle(id: string, patch: Partial<ConnectorStyle>) {
    projectStore.update((p) => {
      const current = p.nodes[id] as ConnectorNode | undefined;
      if (!current) return p;
      return updateNode(p, id, { style: { ...current.style, ...patch } });
    });
  }

  function updateConnectorMarkers(id: string, patch: Partial<ConnectorNode["markers"]>) {
    projectStore.update((p) => {
      const current = p.nodes[id] as ConnectorNode | undefined;
      if (!current) return p;
      return updateNode(p, id, { markers: { ...current.markers, ...patch } });
    });
  }

  /** Text stores `filterId` directly on the node; shapes/connectors nest it under `style`. */
  function toggleShadow(kind: "text" | "styled", id: string, enabled: boolean) {
    projectStore.update((p) => {
      const node = p.nodes[id];
      if (!node) return p;
      if (!enabled) {
        if (kind === "text") return updateNode(p, id, { filterId: undefined });
        const current = node as ShapeNode | ConnectorNode;
        return updateNode(p, id, { style: { ...current.style, filterId: undefined } });
      }
      const filterId = nextId("filter");
      const withDef = upsertFilterDef(p, defaultDropShadowFilter(filterId));
      if (kind === "text") return updateNode(withDef, id, { filterId });
      const current = withDef.nodes[id] as ShapeNode | ConnectorNode;
      return updateNode(withDef, id, { style: { ...current.style, filterId } });
    });
  }

  function updateShadow(kind: "text" | "styled", id: string, patch: Partial<Omit<FilterDef, "id" | "kind">>) {
    projectStore.update((p) => {
      const node = p.nodes[id];
      if (!node) return p;
      const filterId = kind === "text" ? (node as TextNode).filterId : (node as ShapeNode | ConnectorNode).style.filterId;
      if (!filterId) return p;
      const current = p.defs.filters.find((f) => f.id === filterId);
      if (!current) return p;
      return upsertFilterDef(p, { ...current, ...patch });
    });
  }

  function shadowFilterOf(filterId: string | undefined): FilterDef | undefined {
    if (!filterId) return undefined;
    return projectStore.get().defs.filters.find((f) => f.id === filterId);
  }

  function render() {
    // While the user is mid-edit in a text/number/range/color field inside
    // this panel, a store update from that very field's own 'input' handler
    // would otherwise trigger a full innerHTML rebuild here and destroy
    // focus after every keystroke. A genuine selection change always blurs
    // the field first (the click lands on the canvas, not in this panel),
    // so if focus is still inside `panel` this is just our own edit echoing
    // back - skip the rebuild, the DOM and store already agree.
    const active = document.activeElement;
    if (active && panel.contains(active) && (active.tagName === "INPUT" || active.tagName === "TEXTAREA") && (active as HTMLInputElement).type !== "checkbox") {
      return;
    }

    const view = viewStore.get();
    const project = projectStore.get();

    if (view.selectedIds.length > 1) {
      renderMultiSelectPanel(view.selectedIds);
      return;
    }

    const id = view.selectedIds[0];
    const node = id ? project.nodes[id] : undefined;

    if (!node) {
      renderCanvasSettings(panel, projectStore, onResetBoard);
      return;
    }
    if (node.type === "text") {
      renderTextPanel(node as TextNode);
      return;
    }
    if (SHAPE_NODE_TYPES.has(node.type)) {
      renderShapePanel(node as ShapeNode);
      return;
    }
    if (node.type === "connector") {
      renderConnectorPanel(node as ConnectorNode);
      return;
    }
    if (node.type === "group") {
      renderGroupPanel(node.id);
      return;
    }
    panel.innerHTML = PLACEHOLDER;
  }

  function renderMultiSelectPanel(ids: string[]) {
    panel.innerHTML = `
      <h3>Properties</h3>
      <p class="note-text">${ids.length} objects selected.</p>
      <h3 class="section-heading">Align</h3>
      <div class="align-grid">
        <button data-align="left" title="Align left edges">Left</button>
        <button data-align="centerX" title="Align horizontal centers">Center</button>
        <button data-align="right" title="Align right edges">Right</button>
        <button data-align="top" title="Align top edges">Top</button>
        <button data-align="centerY" title="Align vertical centers">Middle</button>
        <button data-align="bottom" title="Align bottom edges">Bottom</button>
      </div>
      <div class="align-grid align-grid-2">
        <button data-distribute="x" title="Distribute evenly, left to right (3+ objects)" ${ids.length < 3 ? "disabled" : ""}>Distribute H</button>
        <button data-distribute="y" title="Distribute evenly, top to bottom (3+ objects)" ${ids.length < 3 ? "disabled" : ""}>Distribute V</button>
      </div>
      <button id="group-btn" class="secondary-btn">Group</button>
    `;
    panel.querySelectorAll<HTMLButtonElement>("[data-align]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.align as AlignMode;
        projectStore.update((p) => alignNodes(p, ids, mode));
      });
    });
    panel.querySelectorAll<HTMLButtonElement>("[data-distribute]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const axis = btn.dataset.distribute as "x" | "y";
        projectStore.update((p) => distributeNodes(p, ids, axis));
      });
    });
    panel.querySelector<HTMLButtonElement>("#group-btn")!.addEventListener("click", () => {
      projectStore.update((p) => groupNodes(p, ids));
      // Selection now points at the ids we just grouped away; select the new group instead.
      const newGroupId = projectStore.get().order[projectStore.get().order.length - 1];
      viewStore.patch({ ...viewStore.get(), selectedIds: [newGroupId] });
    });
  }

  function renderGroupPanel(groupId: string) {
    panel.innerHTML = `
      <h3>Properties</h3>
      <p class="note-text">Group of shapes. Drag to move them together.</p>
      <button id="ungroup-btn" class="secondary-btn">Ungroup</button>
    `;
    panel.querySelector<HTMLButtonElement>("#ungroup-btn")!.addEventListener("click", () => {
      projectStore.update((p) => ungroupNode(p, groupId));
      viewStore.patch({ ...viewStore.get(), selectedIds: [] });
    });
  }

  function renderConnectorPanel(connector: ConnectorNode) {
    const stroke = connector.style.stroke;
    const strokeMode = stroke.kind === "gradient" ? gradientModeOf(connector) : "solid";
    const solidColor = stroke.kind === "solid" ? stroke.color : "#475569";
    const gradientDef = stroke.kind === "gradient" ? projectStore.get().defs.gradients.find((g) => g.id === stroke.gradientId) : undefined;
    const customStops = gradientDef?.stops ?? [
      { offset: 0, color: "#2563eb" },
      { offset: 1, color: "#7c3aed" },
    ];

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

      <h3 class="section-heading">Stroke color</h3>
      <label class="field">Mode
        <select id="conn-stroke-mode">
          <option value="solid" ${strokeMode === "solid" ? "selected" : ""}>Solid</option>
          <option value="auto" ${strokeMode === "auto" ? "selected" : ""}>Gradient (auto)</option>
          <option value="custom" ${strokeMode === "custom" ? "selected" : ""}>Gradient (custom)</option>
        </select>
      </label>
      ${strokeMode === "solid" ? `<label class="field">Color<input type="color" id="conn-solid-color" value="${solidColor}"></label>` : ""}
      ${
        strokeMode === "custom"
          ? `<label class="field">Start<input type="color" id="conn-grad-start" value="${customStops[0].color}"></label>
             <label class="field">End<input type="color" id="conn-grad-end" value="${customStops[customStops.length - 1].color}"></label>`
          : ""
      }
      ${strokeMode === "auto" ? `<p class="note-text">Colors follow the connected shapes' fill colors automatically.</p>` : ""}

      <h3 class="section-heading">Line</h3>
      <label class="field">Style
        <select id="conn-dash">
          <option value="solid" ${connector.style.dash === "solid" ? "selected" : ""}>Solid</option>
          <option value="dashed" ${connector.style.dash === "dashed" ? "selected" : ""}>Dashed</option>
          <option value="dotted" ${connector.style.dash === "dotted" ? "selected" : ""}>Dotted</option>
        </select>
      </label>
      ${connector.style.dash === "dashed" ? `<label class="field">Dash length<input type="number" id="conn-dash-length" min="1" max="100" value="${connector.style.dashLength}"></label>` : ""}
      ${connector.style.dash !== "solid" ? `<label class="field">Rounded dashes<input type="checkbox" id="conn-dash-rounded" ${connector.style.dashRounded ? "checked" : ""}></label>` : ""}
      <label class="field">Animate flow<input type="checkbox" id="conn-animate" ${connector.style.animated ? "checked" : ""}></label>
      ${connector.style.animated ? `<label class="field">Speed (s)<input type="number" id="conn-anim-speed" min="0.1" step="0.1" value="${connector.style.animationSeconds}"></label>` : ""}

      <h3 class="section-heading">Terminators</h3>
      <label class="field">Start${markerSelectHtml("conn-marker-start", connector.markers.start)}</label>
      <label class="field">End${markerSelectHtml("conn-marker-end", connector.markers.end)}</label>
      <label class="field">Size<input type="number" id="conn-marker-size" min="4" max="60" step="1" value="${connector.markers.size}"></label>

      ${effectsFieldsHtml("conn-shadow", shadowFilterOf(connector.style.filterId))}

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
      updateConnectorStyle(connector.id, { strokeWidth: Number((e.target as HTMLInputElement).value) });
    });

    panel.querySelector<HTMLSelectElement>("#conn-stroke-mode")!.addEventListener("change", (e) => {
      const mode = (e.target as HTMLSelectElement).value as "solid" | "auto" | "custom";
      if (mode === "solid") {
        updateConnectorStyle(connector.id, { stroke: { kind: "solid", color: solidColor } });
        return;
      }
      const gradientId = nextId("gradient");
      projectStore.update((p) => {
        const withDef = upsertGradientDef(p, { id: gradientId, kind: "linear", mode, stops: mode === "custom" ? customStops : undefined });
        const current = withDef.nodes[connector.id] as ConnectorNode;
        return updateNode(withDef, connector.id, { style: { ...current.style, stroke: { kind: "gradient", gradientId } } });
      });
    });
    panel.querySelector<HTMLInputElement>("#conn-solid-color")?.addEventListener("input", (e) => {
      updateConnectorStyle(connector.id, { stroke: { kind: "solid", color: (e.target as HTMLInputElement).value } });
    });
    panel.querySelector<HTMLInputElement>("#conn-grad-start")?.addEventListener("input", (e) => {
      updateCustomGradientStop(connector, 0, (e.target as HTMLInputElement).value, customStops);
    });
    panel.querySelector<HTMLInputElement>("#conn-grad-end")?.addEventListener("input", (e) => {
      updateCustomGradientStop(connector, 1, (e.target as HTMLInputElement).value, customStops);
    });

    panel.querySelector<HTMLSelectElement>("#conn-dash")!.addEventListener("change", (e) => {
      updateConnectorStyle(connector.id, { dash: (e.target as HTMLSelectElement).value as DashKind });
    });
    panel.querySelector<HTMLInputElement>("#conn-dash-length")?.addEventListener("input", (e) => {
      updateConnectorStyle(connector.id, { dashLength: Number((e.target as HTMLInputElement).value) });
    });
    panel.querySelector<HTMLInputElement>("#conn-dash-rounded")?.addEventListener("change", (e) => {
      updateConnectorStyle(connector.id, { dashRounded: (e.target as HTMLInputElement).checked });
    });
    panel.querySelector<HTMLInputElement>("#conn-animate")!.addEventListener("change", (e) => {
      updateConnectorStyle(connector.id, { animated: (e.target as HTMLInputElement).checked });
    });
    panel.querySelector<HTMLInputElement>("#conn-anim-speed")?.addEventListener("input", (e) => {
      updateConnectorStyle(connector.id, { animationSeconds: Number((e.target as HTMLInputElement).value) });
    });

    panel.querySelector<HTMLSelectElement>("#conn-marker-start")!.addEventListener("change", (e) => {
      updateConnectorMarkers(connector.id, { start: (e.target as HTMLSelectElement).value as MarkerType });
    });
    panel.querySelector<HTMLSelectElement>("#conn-marker-end")!.addEventListener("change", (e) => {
      updateConnectorMarkers(connector.id, { end: (e.target as HTMLSelectElement).value as MarkerType });
    });
    panel.querySelector<HTMLInputElement>("#conn-marker-size")!.addEventListener("input", (e) => {
      updateConnectorMarkers(connector.id, { size: Number((e.target as HTMLInputElement).value) });
    });

    bindEffectsFields(
      panel,
      "conn-shadow",
      (enabled) => toggleShadow("styled", connector.id, enabled),
      (patch) => updateShadow("styled", connector.id, patch)
    );

    panel.querySelector<HTMLButtonElement>("#prop-delete")!.addEventListener("click", () => {
      projectStore.update((p) => removeNode(p, connector.id));
      viewStore.patch({ ...viewStore.get(), selectedIds: [] });
    });
  }

  function gradientModeOf(connector: ConnectorNode): "auto" | "custom" {
    const stroke = connector.style.stroke;
    if (stroke.kind !== "gradient") return "custom";
    const def = projectStore.get().defs.gradients.find((g) => g.id === stroke.gradientId);
    return def?.mode ?? "custom";
  }

  function updateCustomGradientStop(connector: ConnectorNode, index: 0 | 1, color: string, currentStops: { offset: number; color: string }[]) {
    if (connector.style.stroke.kind !== "gradient") return;
    const gradientId = connector.style.stroke.gradientId;
    const stops = [...currentStops];
    stops[index] = { ...stops[index], color };
    projectStore.update((p) => upsertGradientDef(p, { id: gradientId, kind: "linear", mode: "custom", stops }));
  }

  function markerSelectHtml(id: string, current: MarkerType): string {
    const options = MARKER_OPTIONS.map((o) => `<option value="${o.value}" ${o.value === current ? "selected" : ""}>${o.label}</option>`).join("");
    return `<select id="${id}">${options}</select>`;
  }

  function renderShapePanel(shape: ShapeNode) {
    if (shape.type === "image") {
      renderImagePanel(shape);
      return;
    }
    const fillColor = shape.style.fill.kind === "solid" ? shape.style.fill.color : "#2563eb";

    panel.innerHTML = `
      <h3>Properties</h3>
      <label class="field">Fill<input type="color" id="prop-fill" value="${fillColor}"></label>
      <label class="field">Stroke<input type="color" id="prop-stroke" value="${shape.style.stroke}"></label>
      <label class="field">Stroke width<input type="number" id="prop-stroke-width" min="0" max="40" value="${shape.style.strokeWidth}"></label>
      <label class="field">Stroke style
        <select id="prop-stroke-dash">
          <option value="solid" ${shape.style.strokeDash === "solid" ? "selected" : ""}>Solid</option>
          <option value="dashed" ${shape.style.strokeDash === "dashed" ? "selected" : ""}>Dashed</option>
          <option value="dotted" ${shape.style.strokeDash === "dotted" ? "selected" : ""}>Dotted</option>
        </select>
      </label>
      ${shape.style.strokeDash === "dashed" ? `<label class="field">Dash length<input type="number" id="prop-stroke-dash-length" min="1" max="100" value="${shape.style.strokeDashLength}"></label>` : ""}
      ${shape.style.strokeDash !== "solid" ? `<label class="field">Rounded dashes<input type="checkbox" id="prop-stroke-dash-rounded" ${shape.style.strokeDashRounded ? "checked" : ""}></label>` : ""}
      <label class="field">Animate stroke<input type="checkbox" id="prop-stroke-animate" ${shape.style.strokeAnimated ? "checked" : ""}></label>
      ${shape.style.strokeAnimated ? `<label class="field">Speed (s)<input type="number" id="prop-stroke-anim-speed" min="0.1" step="0.1" value="${shape.style.strokeAnimationSeconds}"></label>` : ""}
      <label class="field">Opacity<input type="range" id="prop-opacity" min="0" max="1" step="0.05" value="${shape.style.opacity}"></label>

      ${effectsFieldsHtml("shape-shadow", shadowFilterOf(shape.style.filterId))}

      <button id="prop-delete" class="danger-btn">Delete shape</button>
      <h3 class="section-heading">Text</h3>
      ${boundTextSectionHtml("title", "Title", shape.boundText?.title)}
      ${boundTextSectionHtml("subtitle", "Subtitle", shape.boundText?.subtitle)}
    `;

    bindEffectsFields(
      panel,
      "shape-shadow",
      (enabled) => toggleShadow("styled", shape.id, enabled),
      (patch) => updateShadow("styled", shape.id, patch)
    );

    panel.querySelector<HTMLInputElement>("#prop-fill")!.addEventListener("input", (e) => {
      updateShapeStyle(shape.id, { fill: { kind: "solid", color: (e.target as HTMLInputElement).value } });
    });
    panel.querySelector<HTMLInputElement>("#prop-stroke")!.addEventListener("input", (e) => {
      updateShapeStyle(shape.id, { stroke: (e.target as HTMLInputElement).value });
    });
    panel.querySelector<HTMLInputElement>("#prop-stroke-width")!.addEventListener("input", (e) => {
      updateShapeStyle(shape.id, { strokeWidth: Number((e.target as HTMLInputElement).value) });
    });
    panel.querySelector<HTMLSelectElement>("#prop-stroke-dash")!.addEventListener("change", (e) => {
      updateShapeStyle(shape.id, { strokeDash: (e.target as HTMLSelectElement).value as DashKind });
    });
    panel.querySelector<HTMLInputElement>("#prop-stroke-dash-length")?.addEventListener("input", (e) => {
      updateShapeStyle(shape.id, { strokeDashLength: Number((e.target as HTMLInputElement).value) });
    });
    panel.querySelector<HTMLInputElement>("#prop-stroke-dash-rounded")?.addEventListener("change", (e) => {
      updateShapeStyle(shape.id, { strokeDashRounded: (e.target as HTMLInputElement).checked });
    });
    panel.querySelector<HTMLInputElement>("#prop-stroke-animate")!.addEventListener("change", (e) => {
      updateShapeStyle(shape.id, { strokeAnimated: (e.target as HTMLInputElement).checked });
    });
    panel.querySelector<HTMLInputElement>("#prop-stroke-anim-speed")?.addEventListener("input", (e) => {
      updateShapeStyle(shape.id, { strokeAnimationSeconds: Number((e.target as HTMLInputElement).value) });
    });
    panel.querySelector<HTMLInputElement>("#prop-opacity")!.addEventListener("input", (e) => {
      updateShapeStyle(shape.id, { opacity: Number((e.target as HTMLInputElement).value) });
    });
    panel.querySelector<HTMLButtonElement>("#prop-delete")!.addEventListener("click", () => {
      projectStore.update((p) => removeNodeCascade(p, shape.id));
      viewStore.patch({ ...viewStore.get(), selectedIds: [] });
    });

    bindBoundTextSection(shape, "title");
    bindBoundTextSection(shape, "subtitle");
  }

  function renderImagePanel(shape: ShapeNode) {
    panel.innerHTML = `
      <h3>Properties</h3>
      <label class="field">Opacity<input type="range" id="prop-opacity" min="0" max="1" step="0.05" value="${shape.style.opacity}"></label>

      ${effectsFieldsHtml("shape-shadow", shadowFilterOf(shape.style.filterId))}

      <button id="prop-replace" class="secondary-btn">Replace image</button>
      <button id="prop-delete" class="danger-btn">Delete image</button>
    `;

    panel.querySelector<HTMLInputElement>("#prop-opacity")!.addEventListener("input", (e) => {
      updateShapeStyle(shape.id, { opacity: Number((e.target as HTMLInputElement).value) });
    });
    bindEffectsFields(
      panel,
      "shape-shadow",
      (enabled) => toggleShadow("styled", shape.id, enabled),
      (patch) => updateShadow("styled", shape.id, patch)
    );
    panel.querySelector<HTMLButtonElement>("#prop-replace")!.addEventListener("click", () => {
      openImageFilePicker((dataUrl) => {
        projectStore.update((p) => updateNode(p, shape.id, { imageSrc: dataUrl }));
      });
    });
    panel.querySelector<HTMLButtonElement>("#prop-delete")!.addEventListener("click", () => {
      projectStore.update((p) => removeNodeCascade(p, shape.id));
      viewStore.patch({ ...viewStore.get(), selectedIds: [] });
    });
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

      ${effectsFieldsHtml("text-shadow", shadowFilterOf(text.filterId))}

      <button id="prop-delete" class="danger-btn">Delete text</button>
    `;

    panel.querySelector<HTMLInputElement>("#text-content")!.addEventListener("input", (e) => {
      projectStore.update((p) => updateNode(p, text.id, { content: (e.target as HTMLInputElement).value }));
    });
    bindEffectsFields(
      panel,
      "text-shadow",
      (enabled) => toggleShadow("text", text.id, enabled),
      (patch) => updateShadow("text", text.id, patch)
    );
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
