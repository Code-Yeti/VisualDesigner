import type { Store } from "@/core/store";
import type { PolygonGeom, Project, ShapeNode } from "@/core/model";
import { defaultTransform } from "@/core/model";
import type { ViewState } from "@/core/viewState";
import { clientToWorld } from "./coords";
import { nextId } from "@/core/ids";
import { addNode } from "@/core/mutations";
import { defaultPorts } from "@/core/geometry";
import { svgEl, setAttrs } from "@/render/svgUtil";

/** Click to place vertices; double-click or Enter finishes; Escape cancels. */
export function attachDrawPolygonTool(
  container: HTMLElement,
  draftLayer: SVGGElement,
  projectStore: Store<Project>,
  viewStore: Store<ViewState>
): void {
  let points: { x: number; y: number }[] = [];
  let previewEl: SVGPolylineElement | null = null;
  let vertexEls: SVGCircleElement[] = [];

  function isActive() {
    return viewStore.get().activeTool === "polygon";
  }

  function clearDraft() {
    previewEl?.remove();
    previewEl = null;
    for (const v of vertexEls) v.remove();
    vertexEls = [];
    points = [];
  }

  function updatePreview(cursor?: { x: number; y: number }) {
    if (!previewEl) return;
    const all = cursor ? [...points, cursor] : points;
    setAttrs(previewEl, { points: all.map((p) => `${p.x},${p.y}`).join(" ") });
  }

  function finish() {
    if (points.length < 3) {
      clearDraft();
      return;
    }
    const minX = Math.min(...points.map((p) => p.x));
    const minY = Math.min(...points.map((p) => p.y));
    const localPoints = points.map((p) => ({ x: p.x - minX, y: p.y - minY }));

    const id = nextId("polygon");
    const node: ShapeNode = {
      id,
      type: "polygon",
      parentId: null,
      visible: true,
      transform: { ...defaultTransform(), x: minX, y: minY },
      geometry: { kind: "polygon", points: localPoints } as PolygonGeom,
      style: { fill: { kind: "solid", color: "#2563eb" }, stroke: "#1e40af", strokeWidth: 2, opacity: 1 },
      ports: defaultPorts(),
    };
    projectStore.update((p) => addNode(p, node));
    viewStore.patch({ ...viewStore.get(), activeTool: "select", selectedIds: [id] });
    clearDraft();
  }

  container.addEventListener("pointerdown", (e) => {
    if (!isActive()) return;
    if (e.detail > 1) return; // the 2nd click of a dblclick shouldn't add a duplicate vertex
    const world = clientToWorld(e.clientX, e.clientY, container, viewStore.get());
    points.push(world);

    const vertex = svgEl("circle", {
      cx: world.x,
      cy: world.y,
      r: 4 / viewStore.get().zoom,
      class: "polygon-vertex",
    });
    draftLayer.appendChild(vertex);
    vertexEls.push(vertex);

    if (!previewEl) {
      previewEl = svgEl("polyline", { class: "polygon-draft" });
      draftLayer.appendChild(previewEl);
    }
    updatePreview();
    e.stopPropagation();
  });

  container.addEventListener("pointermove", (e) => {
    if (!isActive() || points.length === 0) return;
    const world = clientToWorld(e.clientX, e.clientY, container, viewStore.get());
    updatePreview(world);
  });

  container.addEventListener("dblclick", (e) => {
    if (!isActive()) return;
    e.preventDefault();
    finish();
  });

  window.addEventListener("keydown", (e) => {
    if (!isActive()) return;
    if (e.key === "Enter") finish();
    if (e.key === "Escape") clearDraft();
  });
}
