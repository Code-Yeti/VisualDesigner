import { Store } from "@/core/store";
import { createEmptyProject, type Project } from "@/core/model";
import { createInitialViewState, type ViewState } from "@/core/viewState";
import { mountRenderer } from "@/render/renderer";
import { attachPanZoom } from "@/tools/panZoomTool";

const project = createEmptyProject(1200, 700);
const projectStore = new Store<Project>(project);
const viewStore = new Store<ViewState>(createInitialViewState(project.canvas.width, project.canvas.height));

const app = document.getElementById("app")!;

const toolbar = document.createElement("div");
toolbar.className = "app-toolbar";
toolbar.innerHTML = `
  <span class="brand">VisualDesigner</span>
  <button id="tool-select" class="active" title="Select">Select</button>
  <button id="tool-pan" title="Pan (or hold Space)">Pan</button>
  <button id="zoom-reset" title="Reset view">100%</button>
`;

const main = document.createElement("div");
main.className = "app-main";

const layersPanel = document.createElement("div");
layersPanel.className = "side-panel left";
layersPanel.innerHTML = `<h3>Layers</h3><div class="panel-placeholder">No objects yet.</div>`;

const canvasArea = document.createElement("div");
canvasArea.className = "canvas-area";

const propertiesPanel = document.createElement("div");
propertiesPanel.className = "side-panel right";
propertiesPanel.innerHTML = `<h3>Properties</h3><div class="panel-placeholder">Select an object to edit its properties.</div>`;

main.append(layersPanel, canvasArea, propertiesPanel);
app.append(toolbar, main);

const handles = mountRenderer(canvasArea, projectStore, viewStore);
attachPanZoom(handles.container, viewStore);

const selectBtn = toolbar.querySelector<HTMLButtonElement>("#tool-select")!;
const panBtn = toolbar.querySelector<HTMLButtonElement>("#tool-pan")!;
const zoomResetBtn = toolbar.querySelector<HTMLButtonElement>("#zoom-reset")!;

function setTool(tool: "select" | "pan") {
  viewStore.patch({ ...viewStore.get(), activeTool: tool });
  selectBtn.classList.toggle("active", tool === "select");
  panBtn.classList.toggle("active", tool === "pan");
}

selectBtn.addEventListener("click", () => setTool("select"));
panBtn.addEventListener("click", () => setTool("pan"));
zoomResetBtn.addEventListener("click", () => {
  viewStore.patch(createInitialViewState(projectStore.get().canvas.width, projectStore.get().canvas.height));
});
