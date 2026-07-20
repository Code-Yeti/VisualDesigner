import type { Store } from "@/core/store";
import type { Project } from "@/core/model";
import type { ViewState } from "@/core/viewState";
import { computeViewBox } from "@/core/viewState";
import { svgEl, setAttrs } from "./svgUtil";

export interface RendererHandles {
  container: HTMLDivElement;
  stage: SVGSVGElement;
  stageDefs: SVGDefsElement;
  contentRoot: SVGGElement;
  overlay: SVGSVGElement;
  gridLayer: SVGGElement;
  selectionLayer: SVGGElement;
  marqueeLayer: SVGGElement;
}

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
  const selectionLayer = svgEl("g", { id: "selection-layer" });
  const marqueeLayer = svgEl("g", { id: "marquee-layer" });
  overlay.append(gridLayer, selectionLayer, marqueeLayer);

  container.append(stage, overlay);
  parent.appendChild(container);

  const handles: RendererHandles = {
    container,
    stage,
    stageDefs,
    contentRoot,
    overlay,
    gridLayer,
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

  const resizeObserver = new ResizeObserver(() => applyViewBox());
  resizeObserver.observe(container);

  projectStore.subscribe(() => renderBackground());
  viewStore.subscribe(() => applyViewBox());

  renderBackground();
  // Defer first viewBox application until layout has happened.
  requestAnimationFrame(applyViewBox);

  return handles;
}
