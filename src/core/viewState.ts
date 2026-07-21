// Ephemeral UI/view state: never serialized into the project file, never
// pushed through undo/redo. Pan/zoom, selection, and active tool live here.

export type ToolId =
  | "select"
  | "pan"
  | "rect"
  | "ellipse"
  | "polygon"
  | "cloud"
  | "pill"
  | "icon"
  | "text"
  | "connect"
  | "line";

export interface ViewState {
  /** World-space X of the viewBox's top-left corner. */
  panX: number;
  /** World-space Y of the viewBox's top-left corner. */
  panY: number;
  /** 1 = 100%. Larger = more zoomed in. */
  zoom: number;
  selectedIds: string[];
  activeTool: ToolId;
  /** Which vendored icon preset the "icon" tool will place. */
  activeIconKey: string | null;
  /** Id of the shape currently under the pointer, so ports can be revealed on hover. */
  hoveredShapeId: string | null;
  viewportWidth: number;
  viewportHeight: number;
}

export function createInitialViewState(canvasWidth: number, canvasHeight: number): ViewState {
  const margin = 80;
  return {
    panX: -margin,
    panY: -margin,
    zoom: 1,
    selectedIds: [],
    activeTool: "select",
    activeIconKey: null,
    hoveredShapeId: null,
    viewportWidth: canvasWidth + margin * 2,
    viewportHeight: canvasHeight + margin * 2,
  };
}

/** Computes the SVG `viewBox` string for the current pan/zoom + container size. */
export function computeViewBox(view: ViewState, containerWidth: number, containerHeight: number): string {
  const w = containerWidth / view.zoom;
  const h = containerHeight / view.zoom;
  return `${view.panX} ${view.panY} ${w} ${h}`;
}
