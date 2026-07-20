import type { ConnectorNode, MarkerType, Project, ShapeNode, TextNode } from "@/core/model";
import { SHAPE_NODE_TYPES } from "@/core/model";
import { resolvePortWorldPos } from "@/core/geometry";
import { svgEl, setAttrs } from "./svgUtil";

export function markerDefId(type: string, color: string, size: number, end: "start" | "end"): string {
  return `marker-${type}-${end}-${size}-${color.replace(/[^a-zA-Z0-9]/g, "")}`;
}

/** Creates/updates the live `<linearGradient>` and `<marker>` defs any connector currently needs, and prunes ones no longer referenced. */
export function syncDefs(stageDefs: SVGDefsElement, project: Project): void {
  const neededIds = new Set<string>();

  for (const id of project.order) {
    const node = project.nodes[id];
    if (!node) continue;
    if (node.type === "connector") {
      const connector = node as ConnectorNode;
      syncConnectorGradient(stageDefs, project, connector, neededIds);
      syncConnectorMarkers(stageDefs, connector, neededIds);
      syncFilter(stageDefs, project, connector.style.filterId, neededIds, connectorFilterRegion(project, connector));
    } else if (node.type === "text") {
      syncFilter(stageDefs, project, (node as TextNode).filterId, neededIds);
    } else if (SHAPE_NODE_TYPES.has(node.type)) {
      syncFilter(stageDefs, project, (node as ShapeNode).style.filterId, neededIds);
    }
  }

  for (const el of Array.from(stageDefs.querySelectorAll("[data-generated]"))) {
    if (!neededIds.has(el.id)) el.remove();
  }
}

/**
 * Creates/updates the `<filter>` (a single feDropShadow) a shape/text/connector's
 * `filterId` points at. `userSpaceRegion`, when given, pins the filter region to
 * absolute coordinates instead of the default objectBoundingBox percentages -
 * required for connectors (see `connectorFilterRegion`) since objectBoundingBox
 * is invalid whenever the referencing element's bbox has zero width OR height,
 * which a perfectly vertical or horizontal connector always has, silently
 * hiding the whole element. Shapes/text always have non-zero width AND height
 * so the cheaper percentage-based region is fine for them.
 */
function syncFilter(
  stageDefs: SVGDefsElement,
  project: Project,
  filterId: string | undefined,
  neededIds: Set<string>,
  userSpaceRegion?: { x: number; y: number; width: number; height: number }
): void {
  if (!filterId) return;
  const def = project.defs.filters.find((f) => f.id === filterId);
  if (!def) return;
  neededIds.add(filterId);

  let el = stageDefs.querySelector<SVGFilterElement>(`#${CSS.escape(filterId)}`);
  if (!el) {
    el = svgEl("filter", { id: filterId });
    setAttrs(el, { "data-generated": "true" });
    stageDefs.appendChild(el);
  }
  if (userSpaceRegion) {
    setAttrs(el, {
      filterUnits: "userSpaceOnUse",
      x: userSpaceRegion.x,
      y: userSpaceRegion.y,
      width: userSpaceRegion.width,
      height: userSpaceRegion.height,
    });
  } else {
    // Generous bounds so blur/offset never clip against the filter region's default 10% margin.
    setAttrs(el, { filterUnits: undefined, x: "-60%", y: "-60%", width: "220%", height: "220%" });
  }
  el.replaceChildren(
    svgEl("feDropShadow", {
      dx: def.dx,
      dy: def.dy,
      stdDeviation: def.blur,
      "flood-color": def.color,
      "flood-opacity": def.opacity,
    })
  );
}

/** Absolute filter-region bounds for a connector's drop shadow, padded generously past its two endpoints to cover orthogonal stubs/corners and the shadow's own offset/blur - never zero-width or zero-height even for a perfectly straight vertical/horizontal connector. */
function connectorFilterRegion(project: Project, connector: ConnectorNode): { x: number; y: number; width: number; height: number } | undefined {
  const sourceNode = project.nodes[connector.source.nodeId] as ShapeNode | undefined;
  const targetNode = project.nodes[connector.target.nodeId] as ShapeNode | undefined;
  const sourcePort = sourceNode?.ports.find((p) => p.id === connector.source.portId);
  const targetPort = targetNode?.ports.find((p) => p.id === connector.target.portId);
  if (!sourceNode || !targetNode || !sourcePort || !targetPort) return undefined;

  const a = resolvePortWorldPos(sourceNode, sourcePort);
  const b = resolvePortWorldPos(targetNode, targetPort);
  const pad = 80 + connector.markers.size * 2 + connector.cornerRadius + connector.stubLength;
  const minX = Math.min(a.x, b.x) - pad;
  const minY = Math.min(a.y, b.y) - pad;
  const maxX = Math.max(a.x, b.x) + pad;
  const maxY = Math.max(a.y, b.y) + pad;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function syncConnectorGradient(stageDefs: SVGDefsElement, project: Project, connector: ConnectorNode, neededIds: Set<string>): void {
  if (connector.style.stroke.kind !== "gradient") return;
  const gradientId = connector.style.stroke.gradientId;
  const def = project.defs.gradients.find((g) => g.id === gradientId);
  if (!def) return;
  neededIds.add(gradientId);

  let el = stageDefs.querySelector<SVGLinearGradientElement>(`#${CSS.escape(gradientId)}`);
  if (!el) {
    el = svgEl("linearGradient", { id: gradientId });
    setAttrs(el, { "data-generated": "true" });
    stageDefs.appendChild(el);
  }
  el.replaceChildren();

  // Always userSpaceOnUse with the connector's real endpoints, for both auto
  // and custom mode: objectBoundingBox (the only alternative for "custom")
  // is defined as invalid/ignored by the SVG spec whenever the referencing
  // element's bounding box has zero width OR height - which a perfectly
  // horizontal or vertical connector always has - silently turning the
  // stroke into no paint at all. Real coordinates sidestep that entirely.
  const sourceNode = project.nodes[connector.source.nodeId] as ShapeNode | undefined;
  const targetNode = project.nodes[connector.target.nodeId] as ShapeNode | undefined;
  const sourcePort = sourceNode?.ports.find((p) => p.id === connector.source.portId);
  const targetPort = targetNode?.ports.find((p) => p.id === connector.target.portId);
  if (!sourceNode || !targetNode || !sourcePort || !targetPort) return;

  const sourcePos = resolvePortWorldPos(sourceNode, sourcePort);
  const targetPos = resolvePortWorldPos(targetNode, targetPort);
  setAttrs(el, { gradientUnits: "userSpaceOnUse", x1: sourcePos.x, y1: sourcePos.y, x2: targetPos.x, y2: targetPos.y });

  if (def.mode === "auto") {
    const sourceColor = sourceNode.style.fill.kind === "solid" ? sourceNode.style.fill.color : "#94a3b8";
    const targetColor = targetNode.style.fill.kind === "solid" ? targetNode.style.fill.color : "#94a3b8";
    el.appendChild(svgEl("stop", { offset: "0", "stop-color": sourceColor }));
    el.appendChild(svgEl("stop", { offset: "1", "stop-color": targetColor }));
  } else {
    const stops = def.stops?.length
      ? def.stops
      : [
          { offset: 0, color: "#2563eb" },
          { offset: 1, color: "#7c3aed" },
        ];
    for (const stop of stops) {
      el.appendChild(svgEl("stop", { offset: String(stop.offset), "stop-color": stop.color }));
    }
  }
}

function syncConnectorMarkers(stageDefs: SVGDefsElement, connector: ConnectorNode, neededIds: Set<string>): void {
  const color = connector.style.stroke.kind === "solid" ? connector.style.stroke.color : "#475569";
  const size = connector.markers.size;
  for (const end of ["start", "end"] as const) {
    const type = connector.markers[end];
    if (type === "none") continue;
    const markerId = markerDefId(type, color, size, end);
    neededIds.add(markerId);
    if (stageDefs.querySelector(`#${CSS.escape(markerId)}`)) continue;
    stageDefs.appendChild(buildMarkerElement(markerId, type, color, size, end));
  }
}

// Where each marker shape's "aim point" sits in its own 10x10 local
// coordinate system: the tip for directional shapes (arrow/openArrow), the
// centroid for symmetric ones (circle/diamond). refX/refY pin this exact
// point to the path's start/end vertex - `orient` (auto vs
// auto-start-reverse) only pivots the rest of the shape around that fixed
// point to get the right pointing direction, it does NOT change which
// local point is anchored. Using the same start/end refX for every shape
// regardless of where its own tip/center actually is (the previous bug)
// meant nothing lined up exactly on the port.
const MARKER_ANCHOR: Record<Exclude<MarkerType, "none">, { x: number; y: number }> = {
  arrow: { x: 10, y: 5 },
  openArrow: { x: 9, y: 5 },
  circle: { x: 5, y: 5 },
  diamond: { x: 5, y: 5 },
};

function buildMarkerElement(id: string, type: MarkerType, color: string, size: number, end: "start" | "end"): SVGMarkerElement {
  const orient = end === "start" ? "auto-start-reverse" : "auto";
  const anchor = MARKER_ANCHOR[type as Exclude<MarkerType, "none">];
  const marker = svgEl("marker", {
    id,
    viewBox: "0 0 10 10",
    refX: anchor.x,
    refY: anchor.y,
    markerWidth: size,
    markerHeight: size,
    // userSpaceOnUse (not the SVG default of "strokeWidth") so the
    // terminator's size is absolute and independent of the connector's
    // stroke width, per its own `markers.size` field.
    markerUnits: "userSpaceOnUse",
    orient,
  });
  setAttrs(marker, { "data-generated": "true" });

  switch (type) {
    case "arrow":
      marker.appendChild(svgEl("path", { d: "M0,0 L10,5 L0,10 z", fill: color }));
      break;
    case "openArrow":
      marker.appendChild(svgEl("path", { d: "M1,1 L9,5 L1,9", fill: "none", stroke: color, "stroke-width": 1.5 }));
      break;
    case "circle":
      marker.appendChild(svgEl("circle", { cx: 5, cy: 5, r: 4, fill: color }));
      break;
    case "diamond":
      marker.appendChild(svgEl("path", { d: "M5,0 L10,5 L5,10 L0,5 z", fill: color }));
      break;
  }
  return marker;
}
