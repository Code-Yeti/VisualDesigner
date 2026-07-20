import type { Store } from "@/core/store";
import type { Project, TextNode } from "@/core/model";
import { defaultFont, defaultTransform } from "@/core/model";
import type { ViewState } from "@/core/viewState";
import { clientToWorld, worldToClient } from "./coords";
import { nextId } from "@/core/ids";
import { addNode, updateNode } from "@/core/mutations";
import type { TextEditOverlay } from "./textEditOverlay";

export function attachTextTool(
  container: HTMLElement,
  projectStore: Store<Project>,
  viewStore: Store<ViewState>,
  overlay: TextEditOverlay
): void {
  container.addEventListener("pointerdown", (e) => {
    if (viewStore.get().activeTool !== "text") return;
    // preventDefault, not just stopPropagation: otherwise the browser's
    // native mousedown focus-resolution runs after our handler and blurs
    // the textarea we're about to focus below.
    e.preventDefault();
    e.stopPropagation();

    const world = clientToWorld(e.clientX, e.clientY, container, viewStore.get());
    const id = nextId("text");
    const node: TextNode = {
      id,
      type: "text",
      parentId: null,
      visible: true,
      transform: { ...defaultTransform(), x: world.x, y: world.y },
      content: "Text",
      font: defaultFont(),
      fill: "#1e293b",
    };

    projectStore.update((p) => addNode(p, node));
    viewStore.patch({ ...viewStore.get(), activeTool: "select", selectedIds: [id] });

    const screen = worldToClient(world.x, world.y, container, viewStore.get());
    overlay.open(screen.x, screen.y, node.content, (value) => {
      projectStore.update((p) => updateNode(p, id, { content: value }));
    });
  });
}
