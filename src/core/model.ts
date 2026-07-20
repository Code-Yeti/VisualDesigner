// Core scene-graph types for a VisualDesigner project.
// Flat ID-keyed maps + a paint-order array, rather than a nested tree, so
// z-order / layer-reorder / undo-redo can operate on plain arrays/maps.

export type NodeId = string;

export interface CanvasConfig {
  width: number;
  height: number;
  background: string | null;
  gridSize: number;
  snapEnabled: boolean;
  gridVisible: boolean;
}

export interface Transform {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export function defaultTransform(): Transform {
  return { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
}

export type FillRef =
  | { kind: "solid"; color: string }
  | { kind: "gradient"; gradientId: string }
  | { kind: "none" };

export interface GradientStop {
  offset: number;
  color: string;
}

export interface GradientDef {
  id: string;
  kind: "linear" | "radial";
  mode: "auto" | "custom";
  stops?: GradientStop[];
}

export interface FilterDef {
  id: string;
  kind: "dropShadow";
  dx: number;
  dy: number;
  blur: number;
  color: string;
  opacity: number;
}

/** Matches network.htm's own dropShadow filter exactly, so the "just turn it on" default fits the app's target aesthetic. */
export function defaultDropShadowFilter(id: string): FilterDef {
  return { id, kind: "dropShadow", dx: 0, dy: 3, blur: 3.5, color: "#1e293b", opacity: 0.16 };
}

export interface MarkerDef {
  id: string;
  type: MarkerType;
  color: string;
}

export type MarkerType = "none" | "arrow" | "openArrow" | "circle" | "diamond";

export interface Port {
  id: string;
  x: number; // fractional local coordinate 0..1
  y: number; // fractional local coordinate 0..1
  side: "n" | "e" | "s" | "w" | "custom";
}

export type NodeType =
  | "rect"
  | "ellipse"
  | "polygon"
  | "cloud"
  | "pill"
  | "icon"
  | "image"
  | "text"
  | "connector"
  | "group";

/** Every node type with shape-like geometry/style/ports - the one place this list lives, imported wherever code needs to distinguish "a shape" from text/connector/group. */
export const SHAPE_NODE_TYPES: ReadonlySet<NodeType> = new Set(["rect", "ellipse", "polygon", "cloud", "pill", "icon", "image"]);

export interface BaseNode {
  id: NodeId;
  type: NodeType;
  name?: string;
  parentId: NodeId | null;
  locked?: boolean;
  visible?: boolean;
  transform: Transform;
}

export interface RectGeom {
  kind: "rect";
  width: number;
  height: number;
  rx: number;
  ry: number;
}

export interface EllipseGeom {
  kind: "ellipse";
  rx: number;
  ry: number;
}

export interface PolygonGeom {
  kind: "polygon";
  points: { x: number; y: number }[];
}

export interface CloudGeom {
  kind: "cloud";
  width: number;
  height: number;
}

export type ShapeGeometry = RectGeom | EllipseGeom | PolygonGeom | CloudGeom;

export interface ShapeStyle {
  fill: FillRef;
  stroke: string;
  strokeWidth: number;
  strokeDash: DashKind;
  /** Length in px of each dash segment (dashed only); the gap is derived from it. */
  strokeDashLength: number;
  /** Rounds dash-segment ends (stroke-linecap: round) - short dashes with this on read as pills/dots. */
  strokeDashRounded: boolean;
  strokeAnimated: boolean;
  strokeAnimationSeconds: number;
  opacity: number;
  filterId?: string;
}

export function defaultShapeStyle(fill: string, stroke: string, strokeWidth: number): ShapeStyle {
  return {
    fill: { kind: "solid", color: fill },
    stroke,
    strokeWidth,
    strokeDash: "solid",
    strokeDashLength: 8,
    strokeDashRounded: false,
    strokeAnimated: false,
    strokeAnimationSeconds: 1,
    opacity: 1,
  };
}

export interface BoundTextItem {
  content: string;
  font: FontStyle;
  fill: string;
}

export interface ShapeNode extends BaseNode {
  type: "rect" | "ellipse" | "polygon" | "cloud" | "pill" | "icon" | "image";
  geometry: ShapeGeometry;
  style: ShapeStyle;
  ports: Port[];
  /** Title/subtitle text rendered inside the shape, embedded (not a separate node) so it always moves/rotates with its shape. */
  boundText?: { title?: BoundTextItem; subtitle?: BoundTextItem };
  iconKey?: string; // for type === 'icon'
  imageSrc?: string; // data: URI, for type === 'image' - raster (png/jpg/webp/gif) or SVG, both render via the same <image> element
}

export interface FontStyle {
  family: string;
  size: number;
  weight: "normal" | "bold";
  italic: boolean;
  letterSpacing: number;
  align: "start" | "middle" | "end";
}

export function defaultFont(): FontStyle {
  return {
    family: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif",
    size: 15,
    weight: "normal",
    italic: false,
    letterSpacing: 0,
    align: "start",
  };
}

export interface TextNode extends BaseNode {
  type: "text";
  content: string;
  font: FontStyle;
  fill: string;
  filterId?: string;
}

export type RoutingKind = "straight" | "orthogonal" | "bezier";
export type DashKind = "solid" | "dashed" | "dotted";

export interface ConnectorStyle {
  stroke: FillRef;
  strokeWidth: number;
  dash: DashKind;
  /** Length in px of each dash segment (dashed only); the gap is derived from it. */
  dashLength: number;
  /** Rounds dash-segment ends (stroke-linecap: round) - short dashes with this on read as pills/dots. */
  dashRounded: boolean;
  animated: boolean;
  animationSeconds: number;
  filterId?: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface ConnectorNode extends BaseNode {
  type: "connector";
  source: { nodeId: NodeId; portId: NodeId };
  target: { nodeId: NodeId; portId: NodeId };
  routing: RoutingKind;
  cornerRadius: number;
  stubLength: number;
  style: ConnectorStyle;
  markers: { start: MarkerType; end: MarkerType; size: number };
  /** User-placed bend points for orthogonal routing, in paint order between the source and target stubs. Undefined/empty falls back to the single auto-computed elbow. */
  waypoints?: Point[];
  /** User-dragged bezier handles, overriding the auto-computed tension-based control points. Undefined falls back to auto. */
  bezierControls?: { c1: Point; c2: Point };
}

export interface GroupNode extends BaseNode {
  type: "group";
  childIds: NodeId[];
}

export type SceneNode = ShapeNode | TextNode | ConnectorNode | GroupNode;

export interface ProjectDefs {
  gradients: GradientDef[];
  filters: FilterDef[];
  markers: MarkerDef[];
}

export interface Project {
  version: number;
  canvas: CanvasConfig;
  defs: ProjectDefs;
  nodes: Record<NodeId, SceneNode>;
  order: NodeId[];
}

export const PROJECT_VERSION = 1;

export function createEmptyProject(width = 1200, height = 700): Project {
  return {
    version: PROJECT_VERSION,
    canvas: {
      width,
      height,
      background: "#ffffff",
      gridSize: 20,
      snapEnabled: true,
      gridVisible: true,
    },
    defs: { gradients: [], filters: [], markers: [] },
    nodes: {},
    order: [],
  };
}
