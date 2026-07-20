import type { Store } from "@/core/store";
import type { ViewState } from "@/core/viewState";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;

/**
 * Wires pan (middle-mouse drag, or left-drag while Space is held, or while the
 * "pan" tool is active) and wheel-zoom (centered on the cursor) onto the given
 * element. Mutates the view store; never touches the project store.
 */
export function attachPanZoom(target: HTMLElement, viewStore: Store<ViewState>): void {
  let spaceHeld = false;
  let panning = false;
  let lastClientX = 0;
  let lastClientY = 0;

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") spaceHeld = true;
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Space") spaceHeld = false;
  });

  function shouldPan(e: PointerEvent): boolean {
    if (e.button === 1) return true; // middle mouse
    if (e.button === 0 && (spaceHeld || viewStore.get().activeTool === "pan")) return true;
    return false;
  }

  target.addEventListener("pointerdown", (e) => {
    if (!shouldPan(e)) return;
    panning = true;
    lastClientX = e.clientX;
    lastClientY = e.clientY;
    target.setPointerCapture(e.pointerId);
    target.classList.add("is-panning");
    e.preventDefault();
  });

  target.addEventListener("pointermove", (e) => {
    if (!panning) return;
    const dxClient = e.clientX - lastClientX;
    const dyClient = e.clientY - lastClientY;
    lastClientX = e.clientX;
    lastClientY = e.clientY;
    const view = viewStore.get();
    viewStore.patch({
      ...view,
      panX: view.panX - dxClient / view.zoom,
      panY: view.panY - dyClient / view.zoom,
    });
  });

  function endPan(e: PointerEvent) {
    if (!panning) return;
    panning = false;
    target.releasePointerCapture(e.pointerId);
    target.classList.remove("is-panning");
  }
  target.addEventListener("pointerup", endPan);
  target.addEventListener("pointercancel", endPan);

  target.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const view = viewStore.get();
      const rect = target.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      const worldXBefore = view.panX + cursorX / view.zoom;
      const worldYBefore = view.panY + cursorY / view.zoom;

      const zoomFactor = Math.exp(-e.deltaY * 0.0015);
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom * zoomFactor));

      const worldXAfter = view.panX + cursorX / nextZoom;
      const worldYAfter = view.panY + cursorY / nextZoom;

      viewStore.patch({
        ...view,
        zoom: nextZoom,
        panX: view.panX + (worldXBefore - worldXAfter),
        panY: view.panY + (worldYBefore - worldYAfter),
      });
    },
    { passive: false }
  );
}
