import type { Store } from "@/core/store";
import type { Project, SceneNode, ShapeNode } from "@/core/model";
import type { ViewState } from "@/core/viewState";
import { computeViewBox } from "@/core/viewState";
import { svgEl, setAttrs } from "./svgUtil";
import { renderShapeNode, disposeShapeCache } from "./nodes/renderShape";

export interface RendererHandles {
  container: HTMLDivElement;
  stage: SVGSVGElement;
  stageDefs: SVGDefsElement;
  contentRoot: SVGGElement;
  overlay: SVGSVGElement;
  gridLayer: SVGGElement;
  draftLayer: SVGGElement;
  selectionLayer: SVGGElement;
  marqueeLayer: SVGGElement;
}

const SHAPE_TYPES = new Set<SceneNode["type"]>(["rect", "ellipse", "polygon", "cloud", "pill", "icon"]);

export function mountRenderer(
  parent: HTMLElement,
  projectStore: Store<Project>,
  viewStore: Store<ViewState>
): RendererHandles {
  const container = document.createElement("div");
  container.className = "canvas-viewport";

  const stage = svgEl("svg", { id: "stage", class: "canvas-svg" });
  const stageDefs = svgEl("defs", { id: "stage-defs" });
  const background = svgEl("rect", { id: "canvas-background" });
  const contentRoot = svgEl("g", { id: "content-root" });
  stage.append(stageDefs, background, contentRoot);

  const overlay = svgEl("svg", { id: "overlay", class: "canvas-svg overlay" });
  const gridLayer = svgEl("g", { id: "grid-layer" });
  const draftLayer = svgEl("g", { id: "draft-layer" });
  const selectionLayer = svgEl("g", { id: "selection-layer" });
  const marqueeLayer = svgEl("g", { id: "marquee-layer" });
  overlay.append(gridLayer, draftLayer, selectionLayer, marqueeLayer);

  container.append(stage, overlay);
  parent.appendChild(container);

  const handles: RendererHandles = {
    container,
    stage,
    stageDefs,
    contentRoot,
    overlay,
    gridLayer,
    draftLayer,
    selectionLayer,
    marqueeLayer,
  };

  function applyViewBox() {
    const view = viewStore.get();
    const rect = container.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    const viewBox = computeViewBox(view, w, h);
    setAttrs(stage, { viewBox, width: w, height: h });
    setAttrs(overlay, { viewBox, width: w, height: h });
  }

  function renderBackground() {
    const { canvas } = projectStore.get();
    setAttrs(background, {
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height,
      fill: canvas.background ?? "none",
      class: "canvas-background-rect",
    });
  }

  const elementCache = new Map<string, SVGGElement>();

  function renderNodes() {
    const project = projectStore.get();
    const seen = new Set<string>();

    for (const id of project.order) {
      const node = project.nodes[id];
      if (!node) continue;
      seen.add(id);

      let g = elementCache.get(id);
      if (!g) {
        g = svgEl("g", { "data-id": id, "data-type": node.type });
        elementCache.set(id, g);
      }
      // appendChild on an already-attached element moves it to the end,
      // so iterating `order` bottom-to-top keeps DOM order == paint order.
      contentRoot.appendChild(g);

      if (SHAPE_TYPES.has(node.type)) {
        renderShapeNode(g, node as ShapeNode);
      }
    }

    for (const [id, g] of elementCache) {
      if (!seen.has(id)) {
        g.remove();
        elementCache.delete(id);
        disposeShapeCache(id);
      }
    }
  }

  const resizeObserver = new ResizeObserver(() => applyViewBox());
  resizeObserver.observe(container);

  projectStore.subscribe(() => {
    renderBackground();
    renderNodes();
  });
  viewStore.subscribe(() => applyViewBox());

  renderBackground();
  renderNodes();
  // Defer first viewBox application until layout has happened.
  requestAnimationFrame(applyViewBox);

  return handles;
}
