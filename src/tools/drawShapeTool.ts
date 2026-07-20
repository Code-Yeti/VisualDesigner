import type { Store } from "@/core/store";
import type { Project, ShapeNode } from "@/core/model";
import { defaultTransform } from "@/core/model";
import type { ViewState } from "@/core/viewState";
import { clientToWorld } from "./coords";
import { nextId } from "@/core/ids";
import { addNode } from "@/core/mutations";
import { svgEl, setAttrs } from "@/render/svgUtil";

const MIN_DRAG = 4;
const DEFAULT_WIDTH = 120;
const DEFAULT_HEIGHT = 80;

function isShapeTool(tool: string): tool is "rect" | "ellipse" {
  return tool === "rect" || tool === "ellipse";
}

export function attachDrawShapeTool(
  container: HTMLElement,
  draftLayer: SVGGElement,
  projectStore: Store<Project>,
  viewStore: Store<ViewState>
): void {
  let drawing = false;
  let startWorld = { x: 0, y: 0 };
  let draftEl: SVGRectElement | null = null;

  container.addEventListener("pointerdown", (e) => {
    const tool = viewStore.get().activeTool;
    if (!isShapeTool(tool)) return;

    drawing = true;
    startWorld = clientToWorld(e.clientX, e.clientY, container, viewStore.get());
    draftEl = svgEl("rect", {
      x: startWorld.x,
      y: startWorld.y,
      width: 0,
      height: 0,
      class: "draft-shape",
    });
    draftLayer.appendChild(draftEl);
    container.setPointerCapture(e.pointerId);
    e.stopPropagation();
  });

  container.addEventListener("pointermove", (e) => {
    if (!drawing || !draftEl) return;
    const world = clientToWorld(e.clientX, e.clientY, container, viewStore.get());
    setAttrs(draftEl, {
      x: Math.min(world.x, startWorld.x),
      y: Math.min(world.y, startWorld.y),
      width: Math.abs(world.x - startWorld.x),
      height: Math.abs(world.y - startWorld.y),
    });
  });

  function finish(e: PointerEvent) {
    if (!drawing) return;
    drawing = false;
    const tool = viewStore.get().activeTool;
    const world = clientToWorld(e.clientX, e.clientY, container, viewStore.get());

    let x = Math.min(world.x, startWorld.x);
    let y = Math.min(world.y, startWorld.y);
    let width = Math.abs(world.x - startWorld.x);
    let height = Math.abs(world.y - startWorld.y);

    if (width < MIN_DRAG || height < MIN_DRAG) {
      x = startWorld.x;
      y = startWorld.y;
      width = DEFAULT_WIDTH;
      height = DEFAULT_HEIGHT;
    }

    draftEl?.remove();
    draftEl = null;
    container.releasePointerCapture(e.pointerId);

    if (!isShapeTool(tool)) return;

    const id = nextId(tool);
    const node: ShapeNode = {
      id,
      type: tool,
      parentId: null,
      visible: true,
      transform: { ...defaultTransform(), x, y },
      geometry:
        tool === "rect"
          ? { kind: "rect", width, height, rx: 8, ry: 8 }
          : { kind: "ellipse", rx: width / 2, ry: height / 2 },
      style: {
        fill: { kind: "solid", color: "#2563eb" },
        stroke: "#1e40af",
        strokeWidth: 2,
        opacity: 1,
      },
      ports: [],
    };

    projectStore.update((p) => addNode(p, node));
    viewStore.patch({ ...viewStore.get(), activeTool: "select", selectedIds: [id] });
  }

  container.addEventListener("pointerup", finish);
  container.addEventListener("pointercancel", finish);
}
