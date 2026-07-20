import type { ViewState } from "@/core/viewState";

/** Converts a client-space (viewport/screen) point into world/scene coordinates. */
export function clientToWorld(
  clientX: number,
  clientY: number,
  container: HTMLElement,
  view: ViewState
): { x: number; y: number } {
  const rect = container.getBoundingClientRect();
  return {
    x: view.panX + (clientX - rect.left) / view.zoom,
    y: view.panY + (clientY - rect.top) / view.zoom,
  };
}
