import type { Store } from "@/core/store";
import type { Project, ShapeNode, TextNode } from "@/core/model";
import { defaultFont } from "@/core/model";
import type { ViewState } from "@/core/viewState";
import { worldToClient } from "./coords";
import { updateNode } from "@/core/mutations";
import { getBoundTextLayout } from "@/core/textLayout";
import type { TextEditOverlay } from "./textEditOverlay";

const SHAPE_TYPES = new Set(["rect", "ellipse", "polygon", "cloud", "pill", "icon"]);

/** Double-click a text node, or a shape's title/subtitle (or the shape body itself), to edit its content in place. */
export function attachTextEditTool(
  container: HTMLElement,
  projectStore: Store<Project>,
  viewStore: Store<ViewState>,
  overlay: TextEditOverlay
): void {
  container.addEventListener("dblclick", (e) => {
    if (viewStore.get().activeTool !== "select") return;
    // Not e.target: an active setPointerCapture from the preceding
    // pointerdown (see selectMoveTool) retargets click/dblclick to the
    // capturing element, so re-hit-test at the real cursor position instead.
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const nodeEl = target?.closest("[data-id]");
    if (!nodeEl) return;
    const nodeId = nodeEl.getAttribute("data-id")!;
    const node = projectStore.get().nodes[nodeId];
    if (!node) return;

    if (node.type === "text") {
      editStandaloneText(node as TextNode);
      return;
    }
    if (!SHAPE_TYPES.has(node.type)) return;

    const boundKey = (target?.closest("[data-bound]")?.getAttribute("data-bound") as "title" | "subtitle" | null) ?? null;
    editBoundText(node as ShapeNode, boundKey);
    e.stopPropagation();
  });

  function editStandaloneText(node: TextNode) {
    const screen = worldToClient(node.transform.x, node.transform.y, container, viewStore.get());
    overlay.open(screen.x, screen.y, node.content, (value) => {
      projectStore.update((p) => updateNode(p, node.id, { content: value }));
    });
  }

  function editBoundText(shape: ShapeNode, explicitKey: "title" | "subtitle" | null) {
    const key: "title" | "subtitle" = explicitKey ?? (shape.boundText?.title ? "subtitle" : "title");
    const existing = shape.boundText?.[key];
    const item = existing ?? { content: "", font: defaultFont(), fill: "#1e293b" };

    const layout = getBoundTextLayout(shape)[key] ?? { x: 16, y: 12 };
    const screen = worldToClient(shape.transform.x + layout.x, shape.transform.y + layout.y, container, viewStore.get());

    overlay.open(screen.x, screen.y, item.content, (value) => {
      projectStore.update((p) => {
        const latest = p.nodes[shape.id] as ShapeNode;
        return updateNode(p, shape.id, {
          boundText: { ...latest.boundText, [key]: { ...item, content: value } },
        });
      });
    });
  }
}
