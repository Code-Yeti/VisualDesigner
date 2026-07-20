import type { ConnectorNode, MarkerType, Project, ShapeNode } from "@/core/model";
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
    if (!node || node.type !== "connector") continue;
    const connector = node as ConnectorNode;
    syncConnectorGradient(stageDefs, project, connector, neededIds);
    syncConnectorMarkers(stageDefs, connector, neededIds);
  }

  for (const el of Array.from(stageDefs.querySelectorAll("[data-generated]"))) {
    if (!neededIds.has(el.id)) el.remove();
  }
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

function buildMarkerElement(id: string, type: MarkerType, color: string, size: number, end: "start" | "end"): SVGMarkerElement {
  const orient = end === "start" ? "auto-start-reverse" : "auto";
  const marker = svgEl("marker", {
    id,
    viewBox: "0 0 10 10",
    refX: end === "start" ? 1 : 9,
    refY: 5,
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
