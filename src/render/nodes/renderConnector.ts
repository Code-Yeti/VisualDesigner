import type { ConnectorNode, Project, ShapeNode } from "@/core/model";
import { resolvePortWorldPos } from "@/core/geometry";
import { computePath } from "@/core/routing";
import { computeDashArray, computeDashRepeatLength } from "@/core/dashPattern";
import { ensureDashKeyframe } from "../dashKeyframes";
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
    waypoints: node.waypoints,
    bezierControls: node.bezierControls,
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

  const dashRepeat = node.style.animated ? computeDashRepeatLength(node.style.dash, node.style.dashLength) : undefined;
  const visiblePath = svgEl("path", {
    d,
    fill: "none",
    stroke: strokeValue(node),
    "stroke-width": node.style.strokeWidth,
    "stroke-dasharray": computeDashArray(node.style.dash, node.style.dashLength),
    "stroke-linecap": node.style.dash !== "solid" && node.style.dashRounded ? "round" : undefined,
    class: node.style.animated ? "dash-ants" : undefined,
    style: dashRepeat !== undefined ? `animation-name:${ensureDashKeyframe(dashRepeat)};animation-duration:${node.style.animationSeconds}s` : undefined,
    "data-dash-repeat": dashRepeat,
    "marker-start": markerStart,
    "marker-end": markerEnd,
    "pointer-events": "none",
    filter: node.style.filterId ? `url(#${node.style.filterId})` : undefined,
  });

  g.append(hitPath, visiblePath);
}
