import type { Store } from "@/core/store";
import type { Project } from "@/core/model";
import { updateCanvasConfig } from "@/core/mutations";

/** Renders into an existing panel element when nothing is selected - the canvas has no other natural home in the properties panel. */
export function renderCanvasSettings(panel: HTMLElement, projectStore: Store<Project>, onResetBoard: () => void): void {
  const { canvas } = projectStore.get();
  const transparent = canvas.background === null;

  panel.innerHTML = `
    <h3>Canvas</h3>
    <label class="field">Width<input type="number" id="canvas-width" min="100" max="8000" value="${canvas.width}"></label>
    <label class="field">Height<input type="number" id="canvas-height" min="100" max="8000" value="${canvas.height}"></label>
    <label class="field">Transparent<input type="checkbox" id="canvas-transparent" ${transparent ? "checked" : ""}></label>
    ${transparent ? "" : `<label class="field">Background<input type="color" id="canvas-bg" value="${canvas.background}"></label>`}

    <h3 class="section-heading">Grid</h3>
    <label class="field">Grid size<input type="number" id="grid-size" min="4" max="200" value="${canvas.gridSize}"></label>
    <label class="field">Show grid<input type="checkbox" id="grid-visible" ${canvas.gridVisible ? "checked" : ""}></label>
    <label class="field">Snap to grid<input type="checkbox" id="snap-enabled" ${canvas.snapEnabled ? "checked" : ""}></label>
    <p class="note-text">The grid is a canvas overlay only - it never appears in exported output.</p>

    <h3 class="section-heading">Danger zone</h3>
    <button id="reset-board-btn" class="danger-btn">Reset board</button>
  `;

  panel.querySelector<HTMLInputElement>("#canvas-width")!.addEventListener("input", (e) => {
    const width = Number((e.target as HTMLInputElement).value);
    projectStore.update((p) => updateCanvasConfig(p, { width }));
  });
  panel.querySelector<HTMLInputElement>("#canvas-height")!.addEventListener("input", (e) => {
    const height = Number((e.target as HTMLInputElement).value);
    projectStore.update((p) => updateCanvasConfig(p, { height }));
  });
  panel.querySelector<HTMLInputElement>("#canvas-transparent")!.addEventListener("change", (e) => {
    const isTransparent = (e.target as HTMLInputElement).checked;
    projectStore.update((p) => updateCanvasConfig(p, { background: isTransparent ? null : "#ffffff" }));
  });
  panel.querySelector<HTMLInputElement>("#canvas-bg")?.addEventListener("input", (e) => {
    const background = (e.target as HTMLInputElement).value;
    projectStore.update((p) => updateCanvasConfig(p, { background }));
  });
  panel.querySelector<HTMLInputElement>("#grid-size")!.addEventListener("input", (e) => {
    const gridSize = Number((e.target as HTMLInputElement).value);
    projectStore.update((p) => updateCanvasConfig(p, { gridSize }));
  });
  panel.querySelector<HTMLInputElement>("#grid-visible")!.addEventListener("change", (e) => {
    const gridVisible = (e.target as HTMLInputElement).checked;
    projectStore.update((p) => updateCanvasConfig(p, { gridVisible }));
  });
  panel.querySelector<HTMLInputElement>("#snap-enabled")!.addEventListener("change", (e) => {
    const snapEnabled = (e.target as HTMLInputElement).checked;
    projectStore.update((p) => updateCanvasConfig(p, { snapEnabled }));
  });
  panel.querySelector<HTMLButtonElement>("#reset-board-btn")!.addEventListener("click", () => {
    if (window.confirm("Reset the board? This deletes every shape, text, and connector on the canvas. You can still undo it with Ctrl+Z right after.")) {
      onResetBoard();
    }
  });
}
