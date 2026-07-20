import type { Store } from "@/core/store";
import type { Project, ShapeGeometry, ShapeNode, ShapeStyle } from "@/core/model";
import { defaultShapeStyle, defaultTransform } from "@/core/model";
import type { ToolId, ViewState } from "@/core/viewState";
import { clientToWorld } from "./coords";
import { nextId } from "@/core/ids";
import { addNode } from "@/core/mutations";
import { defaultPorts } from "@/core/geometry";
import { svgEl, setAttrs } from "@/render/svgUtil";

const MIN_DRAG = 4;

type BBoxTool = "rect" | "ellipse" | "cloud" | "pill" | "icon";

const DEFAULT_SIZE: Record<BBoxTool, { width: number; height: number }> = {
  rect: { width: 120, height: 80 },
  ellipse: { width: 120, height: 80 },
  cloud: { width: 220, height: 90 },
  pill: { width: 140, height: 34 },
  icon: { width: 64, height: 64 },
};

function isBBoxTool(tool: ToolId): tool is BBoxTool {
  return tool === "rect" || tool === "ellipse" || tool === "cloud" || tool === "pill" || tool === "icon";
}

function buildGeometryAndStyle(tool: BBoxTool, width: number, height: number): { geometry: ShapeGeometry; style: ShapeStyle } {
  switch (tool) {
    case "rect":
      return { geometry: { kind: "rect", width, height, rx: 8, ry: 8 }, style: defaultShapeStyle("#2563eb", "#1e40af", 2) };
    case "ellipse":
      return { geometry: { kind: "ellipse", rx: width / 2, ry: height / 2 }, style: defaultShapeStyle("#2563eb", "#1e40af", 2) };
    case "cloud":
      return { geometry: { kind: "cloud", width, height }, style: defaultShapeStyle("#ffffff", "#7c3aed", 2) };
    case "pill":
      return { geometry: { kind: "rect", width, height, rx: height / 2, ry: height / 2 }, style: defaultShapeStyle("#2563eb", "#1e40af", 0) };
    case "icon": {
      const style = defaultShapeStyle("#2563eb", "#1e293b", 1.7);
      return { geometry: { kind: "rect", width, height, rx: 0, ry: 0 }, style: { ...style, fill: { kind: "none" } } };
    }
  }
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
    if (!isBBoxTool(tool)) return;

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

    draftEl?.remove();
    draftEl = null;
    container.releasePointerCapture(e.pointerId);

    if (!isBBoxTool(tool)) return;

    if (width < MIN_DRAG || height < MIN_DRAG) {
      x = startWorld.x;
      y = startWorld.y;
      width = DEFAULT_SIZE[tool].width;
      height = DEFAULT_SIZE[tool].height;
    }

    const id = nextId(tool);
    const { geometry, style } = buildGeometryAndStyle(tool, width, height);
    const node: ShapeNode = {
      id,
      type: tool,
      parentId: null,
      visible: true,
      transform: { ...defaultTransform(), x, y },
      geometry,
      style,
      ports: defaultPorts(),
      ...(tool === "icon" ? { iconKey: viewStore.get().activeIconKey ?? "firewall" } : {}),
    };

    projectStore.update((p) => addNode(p, node));
    viewStore.patch({ ...viewStore.get(), activeTool: "select", selectedIds: [id] });
  }

  container.addEventListener("pointerup", finish);
  container.addEventListener("pointercancel", finish);
}
