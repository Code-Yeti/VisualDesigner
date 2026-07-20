import type { ConnectorNode, Project, ShapeNode } from "@/core/model";
import { resolvePortWorldPos } from "@/core/geometry";
import { computePath } from "@/core/routing";
import { markerDefId } from "../defsManager";
import { svgEl, setAttrs } from "../svgUtil";

function strokeValue(node: ConnectorNode): string {
  const { stroke } = node.style;
  if (stroke.kind === "solid") return stroke.color;
  if (stroke.kind === "gradient") return `url(#${stroke.gradientId})`;
  return "none";
}

export function renderConnectorNode(g: SVGGElement, node: ConnectorNode, project: Project): void {
  setAttrs(g, { opacity: node.visible === false ? 0 : 1 });
  g.replaceChildren();

  const sourceNode = project.nodes[node.source.nodeId] as ShapeNode | undefined;
  const targetNode = project.nodes[node.target.nodeId] as ShapeNode | undefined;
  const sourcePort = sourceNode?.ports.find((p) => p.id === node.source.portId);
  const targetPort = targetNode?.ports.find((p) => p.id === node.target.portId);
  if (!sourceNode || !targetNode || !sourcePort || !targetPort) return;

  const sourcePos = resolvePortWorldPos(sourceNode, sourcePort);
  const targetPos = resolvePortWorldPos(targetNode, targetPort);

  const d = computePath(sourcePos, sourcePort.side, targetPos, targetPort.side, {
    routing: node.routing,
    cornerRadius: node.cornerRadius,
    stubLength: node.stubLength,
  });

  // A wide, invisible hit path makes thin connectors easy to click without affecting the rendered look.
  const hitPath = svgEl("path", {
    d,
    fill: "none",
    stroke: "transparent",
    "stroke-width": Math.max(16, node.style.strokeWidth * 4),
    "pointer-events": "stroke",
  });
  const solidStrokeColor = node.style.stroke.kind === "solid" ? node.style.stroke.color : "#475569";
  const markerSize = node.markers.size;
  const markerStart = node.markers.start !== "none" ? `url(#${markerDefId(node.markers.start, solidStrokeColor, markerSize, "start")})` : undefined;
  const markerEnd = node.markers.end !== "none" ? `url(#${markerDefId(node.markers.end, solidStrokeColor, markerSize, "end")})` : undefined;

  const visiblePath = svgEl("path", {
    d,
    fill: "none",
    stroke: strokeValue(node),
    "stroke-width": node.style.strokeWidth,
    "stroke-dasharray": node.style.dash === "dashed" ? "12 7" : node.style.dash === "dotted" ? "2 5" : undefined,
    class: node.style.animated ? "dash-ants" : undefined,
    style: node.style.animated ? `animation-duration:${node.style.animationSeconds}s` : undefined,
    "marker-start": markerStart,
    "marker-end": markerEnd,
    "pointer-events": "none",
  });

  g.append(hitPath, visiblePath);
}
