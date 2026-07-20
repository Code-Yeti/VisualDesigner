import type { HistoryStore } from "@/core/historyStore";
import type { Store } from "@/core/store";
import type { NodeId, ShapeNode } from "@/core/model";
import type { ViewState } from "@/core/viewState";
import { clientToWorld } from "./coords";
import { getGroupDescendantIds, resolveSelectionRoot, updateNode } from "@/core/mutations";
import { getGroupWorldBBox, getWorldBBox, snapValue, type BBox } from "@/core/geometry";
import { computeAlignmentGuides } from "@/core/alignmentGuides";
import { svgEl, setAttrs } from "@/render/svgUtil";

const SHAPE_TYPES = new Set(["rect", "ellipse", "polygon", "cloud", "pill", "icon"]);
const ALIGN_THRESHOLD = 6;

function bboxesIntersect(a: BBox, b: BBox): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/**
 * Handles selecting a node (click, shift-click to add/remove, marquee-drag
 * on empty canvas for multi-select) and moving it (drag), since in practice
 * those are one gesture in a diagram editor's "select" tool. Clicking any
 * member of a group resolves to the whole group; dragging a group (or a
 * multi-selection) moves every descendant shape by the same delta, since
 * groups have no geometry of their own. A single shape being dragged snaps
 * to alignment with other shapes' edges/centers, with guide lines while
 * dragging.
 */
export function attachSelectMoveTool(
  container: HTMLElement,
  marqueeLayer: SVGGElement,
  draftLayer: SVGGElement,
  projectStore: HistoryStore,
  viewStore: Store<ViewState>
): void {
  let dragging = false;
  let dragIds: NodeId[] = [];
  let startWorld = { x: 0, y: 0 };
  let startPositions = new Map<NodeId, { x: number; y: number }>();
  let singleShapeId: NodeId | null = null;

  let marqueeActive = false;
  let marqueeStart = { x: 0, y: 0 };
  let marqueeEl: SVGRectElement | null = null;
  let marqueeAdditive = false;

  function clearGuides() {
    draftLayer.querySelectorAll(".align-guide").forEach((el) => el.remove());
  }

  container.addEventListener("pointerdown", (e) => {
    if (viewStore.get().activeTool !== "select") return;
    const targetEl = (e.target as Element).closest?.("[data-id]");
    const world = clientToWorld(e.clientX, e.clientY, container, viewStore.get());
    const view = viewStore.get();

    if (!targetEl) {
      marqueeActive = true;
      marqueeAdditive = e.shiftKey;
      marqueeStart = world;
      marqueeEl = svgEl("rect", { x: world.x, y: world.y, width: 0, height: 0, class: "marquee-rect" });
      marqueeLayer.appendChild(marqueeEl);
      container.setPointerCapture(e.pointerId);
      if (!e.shiftKey) viewStore.patch({ ...view, selectedIds: [] });
      return;
    }

    const project = projectStore.get();
    const rawId = targetEl.getAttribute("data-id")!;
    const id = resolveSelectionRoot(project, rawId);
    const node = project.nodes[id];
    if (!node || node.locked) return;

    let selected: NodeId[];
    if (e.shiftKey) {
      selected = view.selectedIds.includes(id) ? view.selectedIds.filter((x) => x !== id) : [...view.selectedIds, id];
    } else if (view.selectedIds.includes(id)) {
      selected = view.selectedIds; // keep existing multi-selection so the whole set can be dragged together
    } else {
      selected = [id];
    }
    viewStore.patch({ ...view, selectedIds: selected });

    if (node.type !== "connector" && selected.includes(id)) {
      const moveIds = new Set<NodeId>();
      for (const sid of selected) {
        const snode = project.nodes[sid];
        if (!snode || snode.type === "connector" || snode.locked) continue;
        for (const leafId of getGroupDescendantIds(project, sid)) moveIds.add(leafId);
      }
      startPositions = new Map();
      for (const mid of moveIds) {
        const mnode = project.nodes[mid];
        if (mnode) startPositions.set(mid, { x: mnode.transform.x, y: mnode.transform.y });
      }
      dragIds = [...moveIds];
      singleShapeId = selected.length === 1 && SHAPE_TYPES.has(node.type) ? id : null;
      dragging = dragIds.length > 0;
      startWorld = world;
      if (dragging) projectStore.beginGesture();
      container.setPointerCapture(e.pointerId);
    }
    e.stopPropagation();
  });

  container.addEventListener("pointermove", (e) => {
    if (marqueeActive && marqueeEl) {
      const world = clientToWorld(e.clientX, e.clientY, container, viewStore.get());
      setAttrs(marqueeEl, {
        x: Math.min(world.x, marqueeStart.x),
        y: Math.min(world.y, marqueeStart.y),
        width: Math.abs(world.x - marqueeStart.x),
        height: Math.abs(world.y - marqueeStart.y),
      });
      return;
    }

    if (!dragging || dragIds.length === 0) return;
    const world = clientToWorld(e.clientX, e.clientY, container, viewStore.get());
    let dx = world.x - startWorld.x;
    let dy = world.y - startWorld.y;

    const { canvas } = projectStore.get();
    if (canvas.snapEnabled) {
      const primary = startPositions.get(dragIds[0]);
      if (primary) {
        dx = snapValue(primary.x + dx, canvas.gridSize) - primary.x;
        dy = snapValue(primary.y + dy, canvas.gridSize) - primary.y;
      }
    }

    clearGuides();
    if (singleShapeId) {
      const project = projectStore.get();
      const shape = project.nodes[singleShapeId] as ShapeNode;
      const start = startPositions.get(singleShapeId)!;
      const movedBBox = { ...getWorldBBox(shape), x: start.x + dx, y: start.y + dy };
      const others: BBox[] = [];
      for (const id of project.order) {
        if (id === singleShapeId) continue;
        const n = project.nodes[id];
        if (!n) continue;
        if (n.type === "group") {
          const b = getGroupWorldBBox(project, id);
          if (b) others.push(b);
        } else if (SHAPE_TYPES.has(n.type)) {
          others.push(getWorldBBox(n as ShapeNode));
        }
      }
      const { dx: snapDx, dy: snapDy, guides } = computeAlignmentGuides(movedBBox, others, ALIGN_THRESHOLD / viewStore.get().zoom);
      dx += snapDx;
      dy += snapDy;
      for (const guide of guides) {
        const el =
          guide.axis === "x"
            ? svgEl("line", { x1: guide.position, y1: guide.from, x2: guide.position, y2: guide.to, class: "align-guide" })
            : svgEl("line", { x1: guide.from, y1: guide.position, x2: guide.to, y2: guide.position, class: "align-guide" });
        draftLayer.appendChild(el);
      }
    }

    projectStore.update((p) => {
      let next = p;
      for (const id of dragIds) {
        const start = startPositions.get(id);
        const node = next.nodes[id];
        if (!start || !node) continue;
        next = updateNode(next, id, { transform: { ...node.transform, x: start.x + dx, y: start.y + dy } });
      }
      return next;
    });
  });

  function finishMarquee(e: PointerEvent) {
    if (!marqueeActive) return;
    marqueeActive = false;
    marqueeEl?.remove();
    marqueeEl = null;
    container.releasePointerCapture(e.pointerId);

    const world = clientToWorld(e.clientX, e.clientY, container, viewStore.get());
    const box: BBox = {
      x: Math.min(world.x, marqueeStart.x),
      y: Math.min(world.y, marqueeStart.y),
      width: Math.abs(world.x - marqueeStart.x),
      height: Math.abs(world.y - marqueeStart.y),
    };
    if (box.width < 3 && box.height < 3) return; // treat as a plain click, not a drag - selection already cleared on pointerdown

    const project = projectStore.get();
    const hitIds: NodeId[] = [];
    for (const id of project.order) {
      const node = project.nodes[id];
      if (!node || node.parentId !== null || node.locked) continue;
      const bbox = node.type === "group" ? getGroupWorldBBox(project, id) : SHAPE_TYPES.has(node.type) ? getWorldBBox(node as ShapeNode) : null;
      if (bbox && bboxesIntersect(box, bbox)) hitIds.push(id);
    }

    const view = viewStore.get();
    const selected = marqueeAdditive ? [...new Set([...view.selectedIds, ...hitIds])] : hitIds;
    viewStore.patch({ ...view, selectedIds: selected });
  }

  function endDrag(e: PointerEvent) {
    finishMarquee(e);
    if (!dragging) return;
    dragging = false;
    dragIds = [];
    singleShapeId = null;
    clearGuides();
    projectStore.endGesture();
    container.releasePointerCapture(e.pointerId);
  }
  container.addEventListener("pointerup", endDrag);
  container.addEventListener("pointercancel", endDrag);
}
