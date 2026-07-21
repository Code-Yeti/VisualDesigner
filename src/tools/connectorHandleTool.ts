import type { HistoryStore } from "@/core/historyStore";
import type { Store } from "@/core/store";
import type { ConnectorNode, Point } from "@/core/model";
import type { ViewState } from "@/core/viewState";
import { clientToWorld } from "./coords";
import { resolveConnectorEndpoints } from "@/core/geometry";
import { getBezierHandlePoints, getOrthogonalBendPoints } from "@/core/routing";
import { updateNode } from "@/core/mutations";

type DragState = { kind: "waypoint"; index: number; waypoints: Point[] } | { kind: "bezier"; handle: "c1" | "c2" } | { kind: "endpoint"; which: "source" | "target" };

function pointToSegmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq > 0 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Drags a connector's orthogonal bend points or bezier control-point handles
 * (drawn by `attachConnectorHandlesOverlay`), and supports double-click to
 * add/remove orthogonal bend points. Bezier stays fixed at its two handles -
 * no add/remove there, matching a standard cubic-bezier editor.
 */
export function attachConnectorHandleTool(
  container: HTMLElement,
  handlesLayer: SVGGElement,
  projectStore: HistoryStore,
  viewStore: Store<ViewState>
): void {
  let activeId: string | null = null;
  let drag: DragState | null = null;

  handlesLayer.addEventListener("pointerdown", (e) => {
    const target = e.target as SVGElement;
    const endpointAttr = target.getAttribute?.("data-endpoint") as "source" | "target" | null;
    const waypointAttr = target.getAttribute?.("data-waypoint-index");
    const bezierHandle = target.getAttribute?.("data-bezier-handle") as "c1" | "c2" | null;
    if (!endpointAttr && waypointAttr === null && !bezierHandle) return;

    const id = viewStore.get().selectedIds[0];
    const node = id ? projectStore.get().nodes[id] : undefined;
    if (!node || node.type !== "connector") return;
    const connector = node as ConnectorNode;

    if (endpointAttr) {
      drag = { kind: "endpoint", which: endpointAttr };
    } else {
      const endpoints = resolveConnectorEndpoints(projectStore.get(), connector);
      if (!endpoints) return;

      if (bezierHandle) {
        drag = { kind: "bezier", handle: bezierHandle };
      } else {
        const bends = getOrthogonalBendPoints(endpoints.sourcePos, endpoints.sourceSide, endpoints.targetPos, endpoints.targetSide, {
          routing: "orthogonal",
          cornerRadius: connector.cornerRadius,
          stubLength: connector.stubLength,
          waypoints: connector.waypoints,
        });
        drag = { kind: "waypoint", index: Number(waypointAttr), waypoints: bends };
      }
    }

    activeId = id;
    projectStore.beginGesture();
    container.setPointerCapture(e.pointerId);
    e.stopPropagation();
  });

  container.addEventListener("pointermove", (e) => {
    if (!activeId || !drag) return;
    const world = clientToWorld(e.clientX, e.clientY, container, viewStore.get());
    const current = drag;

    projectStore.update((p) => {
      const node = p.nodes[activeId!];
      if (!node || node.type !== "connector") return p;
      if (current.kind === "endpoint") {
        return updateNode(p, activeId!, { [current.which]: { x: world.x, y: world.y } });
      }
      if (current.kind === "bezier") {
        const connector = node as ConnectorNode;
        const endpoints = resolveConnectorEndpoints(p, connector);
        if (!endpoints) return p;
        const existing =
          connector.bezierControls ??
          getBezierHandlePoints(endpoints.sourcePos, endpoints.sourceSide, endpoints.targetPos, endpoints.targetSide, {
            routing: "bezier",
            cornerRadius: connector.cornerRadius,
            stubLength: connector.stubLength,
          });
        const next = current.handle === "c1" ? { ...existing, c1: world } : { ...existing, c2: world };
        return updateNode(p, activeId!, { bezierControls: next });
      }
      const waypoints = [...current.waypoints];
      waypoints[current.index] = world;
      return updateNode(p, activeId!, { waypoints });
    });
  });

  function endDrag(e: PointerEvent) {
    if (!activeId) return;
    activeId = null;
    drag = null;
    projectStore.endGesture();
    container.releasePointerCapture(e.pointerId);
  }
  container.addEventListener("pointerup", endDrag);
  container.addEventListener("pointercancel", endDrag);

  // Double-click either a waypoint handle (remove it) or the connector's own
  // rendered path while it's the sole selection (insert a new bend point at
  // the nearest segment). Both branches live on `container`, and both use
  // `document.elementFromPoint` rather than `e.target`/bubbling, because the
  // preceding pointerdown on a handle sets pointer capture on `container` -
  // per the DOM spec that doesn't just relabel `e.target`, it changes which
  // element the click/dblclick is *dispatched on* to the capturing element
  // itself. A listener on a descendant (e.g. `handlesLayer`) would never see
  // an event dispatched on its own ancestor `container`, since events only
  // propagate outward from the target through ancestors, never back down
  // into unrelated descendants - so this can't be split across two layers.
  container.addEventListener("dblclick", (e) => {
    const id = viewStore.get().selectedIds[0];
    if (viewStore.get().selectedIds.length !== 1 || !id) return;
    const node = projectStore.get().nodes[id];
    if (!node || node.type !== "connector") return;
    const connector = node as ConnectorNode;
    if (connector.routing === "straight") return;

    const endpoints = resolveConnectorEndpoints(projectStore.get(), connector);
    if (!endpoints) return;

    const target = document.elementFromPoint(e.clientX, e.clientY);
    const waypointAttr = target?.getAttribute?.("data-waypoint-index") ?? null;

    if (waypointAttr !== null) {
      if (connector.routing !== "orthogonal") return;
      const bends = getOrthogonalBendPoints(endpoints.sourcePos, endpoints.sourceSide, endpoints.targetPos, endpoints.targetSide, {
        routing: "orthogonal",
        cornerRadius: connector.cornerRadius,
        stubLength: connector.stubLength,
        waypoints: connector.waypoints,
      });
      const index = Number(waypointAttr);
      const waypoints = bends.filter((_, i) => i !== index);
      projectStore.update((p) => updateNode(p, id, { waypoints }));
      e.stopPropagation();
      return;
    }

    if (connector.routing !== "orthogonal") return;
    if (viewStore.get().activeTool !== "select") return;
    if (target?.closest("[data-id]")?.getAttribute("data-id") !== id) return;

    const world = clientToWorld(e.clientX, e.clientY, container, viewStore.get());
    const bends = getOrthogonalBendPoints(endpoints.sourcePos, endpoints.sourceSide, endpoints.targetPos, endpoints.targetSide, {
      routing: "orthogonal",
      cornerRadius: connector.cornerRadius,
      stubLength: connector.stubLength,
      waypoints: connector.waypoints,
    });
    const chain = [endpoints.sourcePos, ...bends, endpoints.targetPos];
    let bestIndex = 0;
    let bestDist = Infinity;
    for (let i = 0; i < chain.length - 1; i++) {
      const d = pointToSegmentDistance(world, chain[i], chain[i + 1]);
      if (d < bestDist) {
        bestDist = d;
        bestIndex = i;
      }
    }
    const waypoints = [...bends];
    waypoints.splice(bestIndex, 0, world);
    projectStore.update((p) => updateNode(p, id, { waypoints }));
    e.stopPropagation();
  });
}
