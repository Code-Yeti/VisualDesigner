import type { Store } from "@/core/store";
import type { ConnectorNode, Port, Project, ShapeNode } from "@/core/model";
import { defaultTransform } from "@/core/model";
import type { ViewState } from "@/core/viewState";
import { clientToWorld } from "./coords";
import { nextId } from "@/core/ids";
import { addNode, updateNode } from "@/core/mutations";
import { getLocalSize, resolvePortWorldPos } from "@/core/geometry";
import { svgEl, setAttrs } from "@/render/svgUtil";

const SHAPE_TYPES = new Set(["rect", "ellipse", "polygon", "cloud", "pill", "icon"]);
const DEFAULT_MARKER_SIZE = 12;

interface DragState {
  sourceNodeId: string;
  sourcePortId: string;
  previewEl: SVGLineElement;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** Drag from any point on a shape (a default port, or an arbitrary spot that becomes a new custom port) to another shape to connect them. */
export function attachConnectTool(
  container: HTMLElement,
  draftLayer: SVGGElement,
  projectStore: Store<Project>,
  viewStore: Store<ViewState>
): void {
  let drag: DragState | null = null;

  function isActive() {
    return viewStore.get().activeTool === "connect";
  }

  function findShapeAndFraction(target: Element, world: { x: number; y: number }): { shape: ShapeNode; fx: number; fy: number } | null {
    const nodeEl = target.closest("[data-id]");
    if (!nodeEl) return null;
    const id = nodeEl.getAttribute("data-id")!;
    const node = projectStore.get().nodes[id];
    if (!node || !SHAPE_TYPES.has(node.type)) return null;
    const shape = node as ShapeNode;
    const { width, height } = getLocalSize(shape);
    const fx = width > 0 ? (world.x - shape.transform.x) / width : 0;
    const fy = height > 0 ? (world.y - shape.transform.y) / height : 0;
    return { shape, fx: clamp01(fx), fy: clamp01(fy) };
  }

  /** Resolves a port under `target`: an existing port marker, or a freshly-created custom port at the clicked spot. */
  function ensurePortAt(target: Element, world: { x: number; y: number }): { nodeId: string; portId: string } | null {
    const portEl = target.closest("[data-port-id]");
    if (portEl) {
      return { nodeId: portEl.getAttribute("data-shape-id")!, portId: portEl.getAttribute("data-port-id")! };
    }
    const hit = findShapeAndFraction(target, world);
    if (!hit) return null;

    const portId = nextId("port");
    const port: Port = { id: portId, x: hit.fx, y: hit.fy, side: "custom" };
    projectStore.update((p) => updateNode(p, hit.shape.id, { ports: [...hit.shape.ports, port] }));
    return { nodeId: hit.shape.id, portId };
  }

  container.addEventListener("pointerdown", (e) => {
    if (!isActive()) return;
    const world = clientToWorld(e.clientX, e.clientY, container, viewStore.get());
    const source = ensurePortAt(e.target as Element, world);
    if (!source) return;

    const sourceShape = projectStore.get().nodes[source.nodeId] as ShapeNode;
    const sourcePort = sourceShape.ports.find((p) => p.id === source.portId)!;
    const sourcePos = resolvePortWorldPos(sourceShape, sourcePort);

    const previewEl = svgEl("line", {
      x1: sourcePos.x,
      y1: sourcePos.y,
      x2: sourcePos.x,
      y2: sourcePos.y,
      class: "connector-draft",
    });
    draftLayer.appendChild(previewEl);
    drag = { sourceNodeId: source.nodeId, sourcePortId: source.portId, previewEl };
    container.setPointerCapture(e.pointerId);
    e.stopPropagation();
  });

  container.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const world = clientToWorld(e.clientX, e.clientY, container, viewStore.get());
    setAttrs(drag.previewEl, { x2: world.x, y2: world.y });
  });

  function finish(e: PointerEvent) {
    if (!drag) return;
    const world = clientToWorld(e.clientX, e.clientY, container, viewStore.get());
    // Not e.target: setPointerCapture retargets it to `container` once captured.
    const target = document.elementFromPoint(e.clientX, e.clientY);

    drag.previewEl.remove();
    container.releasePointerCapture(e.pointerId);
    const { sourceNodeId, sourcePortId } = drag;
    drag = null;

    if (!target) return;
    const dest = ensurePortAt(target, world);
    if (!dest) return;
    if (dest.nodeId === sourceNodeId && dest.portId === sourcePortId) return;

    const id = nextId("connector");
    const connector: ConnectorNode = {
      id,
      type: "connector",
      parentId: null,
      visible: true,
      transform: defaultTransform(),
      source: { nodeId: sourceNodeId, portId: sourcePortId },
      target: { nodeId: dest.nodeId, portId: dest.portId },
      routing: "straight",
      cornerRadius: 12,
      stubLength: 24,
      style: { stroke: { kind: "solid", color: "#475569" }, strokeWidth: 2.5, dash: "solid", animated: false, animationSeconds: 1 },
      markers: { start: "none", end: "arrow", size: DEFAULT_MARKER_SIZE },
    };
    projectStore.update((p) => addNode(p, connector));
    viewStore.patch({ ...viewStore.get(), selectedIds: [id] });
  }

  container.addEventListener("pointerup", finish);
  container.addEventListener("pointercancel", () => {
    if (!drag) return;
    drag.previewEl.remove();
    drag = null;
  });
}
