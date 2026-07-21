import { Store } from "@/core/store";
import { HistoryStore } from "@/core/historyStore";
import { createEmptyProject, defaultShapeStyle, defaultTransform, type ShapeNode } from "@/core/model";
import { createInitialViewState, type ViewState } from "@/core/viewState";
import { addNode } from "@/core/mutations";
import { nextId } from "@/core/ids";
import { defaultPorts } from "@/core/geometry";
import { openImageFilePicker } from "@/io/imageFilePicker";
import { mountRenderer } from "@/render/renderer";
import { attachSelectionOverlay, attachPortsOverlay, attachGridOverlay, attachConnectorHandlesOverlay } from "@/render/overlay";
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
import { attachLineTool } from "@/tools/lineTool";
import { attachConnectorHandleTool } from "@/tools/connectorHandleTool";
import { attachKeyboardShortcuts } from "@/tools/keyboardShortcuts";
import { mountToolbar } from "@/panels/Toolbar";
import { mountLayersPanel } from "@/panels/LayersPanel";
import { mountPropertiesPanel } from "@/panels/PropertiesPanel";
import { downloadProjectFile, openProjectFilePicker } from "@/io/fileDialogs";
import { attachAutosave, clearAutosave, loadAutosave } from "@/io/autosave";
import { mountExportMenu } from "@/panels/ExportPanel";
import { mountAnimatedExportButton } from "@/panels/AnimatedExportDialog";

const project = createEmptyProject(1200, 700);
const projectStore = new HistoryStore(project);
const viewStore = new Store<ViewState>(createInitialViewState(project.canvas.width, project.canvas.height));

const app = document.getElementById("app")!;

function resetViewToFitCanvas() {
  viewStore.patch(createInitialViewState(projectStore.get().canvas.width, projectStore.get().canvas.height));
}

const IMAGE_MAX_DIMENSION = 240;

function uploadImage() {
  openImageFilePicker((dataUrl, naturalWidth, naturalHeight) => {
    const scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(naturalWidth, naturalHeight));
    const width = Math.round(naturalWidth * scale);
    const height = Math.round(naturalHeight * scale);

    const view = viewStore.get();
    const centerX = view.panX + view.viewportWidth / view.zoom / 2;
    const centerY = view.panY + view.viewportHeight / view.zoom / 2;

    const id = nextId("image");
    const node: ShapeNode = {
      id,
      type: "image",
      parentId: null,
      visible: true,
      transform: { ...defaultTransform(), x: centerX - width / 2, y: centerY - height / 2 },
      geometry: { kind: "rect", width, height, rx: 0, ry: 0 },
      style: { ...defaultShapeStyle("#000000", "transparent", 0), fill: { kind: "none" } },
      ports: defaultPorts(),
      imageSrc: dataUrl,
    };
    projectStore.update((p) => addNode(p, node));
    viewStore.patch({ ...viewStore.get(), activeTool: "select", selectedIds: [id] });
  });
}

function resetBoard() {
  const canvasSize = projectStore.get().canvas;
  projectStore.patch(createEmptyProject(canvasSize.width, canvasSize.height));
  viewStore.patch({ ...createInitialViewState(canvasSize.width, canvasSize.height), activeTool: "select" });
  clearAutosave();
}

const toolbar = mountToolbar(app, viewStore, projectStore, {
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
  onUploadImage: uploadImage,
});

const main = document.createElement("div");
main.className = "app-main";
app.appendChild(main);

mountLayersPanel(main, projectStore, viewStore);

const canvasArea = document.createElement("div");
canvasArea.className = "canvas-area";
main.appendChild(canvasArea);

mountPropertiesPanel(main, projectStore, viewStore, resetBoard);

const handles = mountRenderer(canvasArea, projectStore, viewStore);

attachPanZoom(handles.container, viewStore);
attachSelectMoveTool(handles.container, handles.marqueeLayer, handles.draftLayer, projectStore, viewStore);
attachResizeTool(handles.container, handles.selectionLayer, projectStore, viewStore);
attachDrawShapeTool(handles.container, handles.draftLayer, projectStore, viewStore);
attachDrawPolygonTool(handles.container, handles.draftLayer, projectStore, viewStore);
attachSelectionOverlay(handles.selectionLayer, projectStore, viewStore);
attachPortsOverlay(handles.portsLayer, projectStore, viewStore);
attachGridOverlay(handles.gridLayer, projectStore);
attachHoverTool(handles.container, projectStore, viewStore);
attachConnectTool(handles.container, handles.draftLayer, projectStore, viewStore);
attachLineTool(handles.container, handles.draftLayer, projectStore, viewStore);
attachConnectorHandlesOverlay(handles.connectorHandlesLayer, projectStore, viewStore);
attachConnectorHandleTool(handles.container, handles.connectorHandlesLayer, projectStore, viewStore);
attachKeyboardShortcuts(projectStore, viewStore);

const textEditOverlay = createTextEditOverlay(handles.container);
attachTextTool(handles.container, projectStore, viewStore, textEditOverlay);
attachTextEditTool(handles.container, projectStore, viewStore, textEditOverlay);

const getExportables = () => ({ project: projectStore.get(), stageDefs: handles.stageDefs, contentRoot: handles.contentRoot });
mountExportMenu(toolbar, getExportables);
mountAnimatedExportButton(toolbar, getExportables);

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
