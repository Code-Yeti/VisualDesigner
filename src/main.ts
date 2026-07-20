import { Store } from "@/core/store";
import { createEmptyProject, type Project } from "@/core/model";
import { createInitialViewState, type ViewState } from "@/core/viewState";
import { mountRenderer } from "@/render/renderer";
import { attachSelectionOverlay, attachPortsOverlay, attachGridOverlay } from "@/render/overlay";
import { attachPanZoom } from "@/tools/panZoomTool";
import { attachSelectMoveTool } from "@/tools/selectMoveTool";
import { attachResizeTool } from "@/tools/resizeTool";
import { attachDrawShapeTool } from "@/tools/drawShapeTool";
import { attachDrawPolygonTool } from "@/tools/drawPolygonTool";
import { attachTextTool } from "@/tools/textTool";
import { attachTextEditTool } from "@/tools/textEditTool";
import { createTextEditOverlay } from "@/tools/textEditOverlay";
import { attachHoverTool } from "@/tools/hoverTool";
import { attachConnectTool } from "@/tools/connectTool";
import { mountToolbar } from "@/panels/Toolbar";
import { mountLayersPanel } from "@/panels/LayersPanel";
import { mountPropertiesPanel } from "@/panels/PropertiesPanel";
import { downloadProjectFile, openProjectFilePicker } from "@/io/fileDialogs";
import { attachAutosave, clearAutosave, loadAutosave } from "@/io/autosave";

const project = createEmptyProject(1200, 700);
const projectStore = new Store<Project>(project);
const viewStore = new Store<ViewState>(createInitialViewState(project.canvas.width, project.canvas.height));

const app = document.getElementById("app")!;

function resetViewToFitCanvas() {
  viewStore.patch(createInitialViewState(projectStore.get().canvas.width, projectStore.get().canvas.height));
}

mountToolbar(app, viewStore, {
  onResetView: resetViewToFitCanvas,
  onSave: () => downloadProjectFile(projectStore.get()),
  onLoad: () => {
    openProjectFilePicker(
      (loaded) => {
        projectStore.patch(loaded);
        viewStore.patch({ ...createInitialViewState(loaded.canvas.width, loaded.canvas.height), activeTool: "select" });
      },
      (message) => window.alert(message)
    );
  },
});

const main = document.createElement("div");
main.className = "app-main";
app.appendChild(main);

mountLayersPanel(main, projectStore, viewStore);

const canvasArea = document.createElement("div");
canvasArea.className = "canvas-area";
main.appendChild(canvasArea);

mountPropertiesPanel(main, projectStore, viewStore);

const handles = mountRenderer(canvasArea, projectStore, viewStore);

attachPanZoom(handles.container, viewStore);
attachSelectMoveTool(handles.container, projectStore, viewStore);
attachResizeTool(handles.container, handles.selectionLayer, projectStore, viewStore);
attachDrawShapeTool(handles.container, handles.draftLayer, projectStore, viewStore);
attachDrawPolygonTool(handles.container, handles.draftLayer, projectStore, viewStore);
attachSelectionOverlay(handles.selectionLayer, projectStore, viewStore);
attachPortsOverlay(handles.portsLayer, projectStore, viewStore);
attachGridOverlay(handles.gridLayer, projectStore);
attachHoverTool(handles.container, projectStore, viewStore);
attachConnectTool(handles.container, handles.draftLayer, projectStore, viewStore);

const textEditOverlay = createTextEditOverlay(handles.container);
attachTextTool(handles.container, projectStore, viewStore, textEditOverlay);
attachTextEditTool(handles.container, projectStore, viewStore, textEditOverlay);

attachAutosave(projectStore);

const autosaved = loadAutosave();
if (autosaved && autosaved.order.length > 0) {
  const banner = document.createElement("div");
  banner.className = "restore-banner";
  banner.innerHTML = `
    <span>Restore unsaved work from your last session?</span>
    <button id="restore-yes">Restore</button>
    <button id="restore-no">Discard</button>
  `;
  document.body.appendChild(banner);
  banner.querySelector("#restore-yes")!.addEventListener("click", () => {
    projectStore.patch(autosaved);
    resetViewToFitCanvas();
    banner.remove();
  });
  banner.querySelector("#restore-no")!.addEventListener("click", () => {
    clearAutosave();
    banner.remove();
  });
}
