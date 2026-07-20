import type { HistoryStore } from "@/core/historyStore";
import type { Store } from "@/core/store";
import type { ViewState } from "@/core/viewState";
import { deleteNodes, duplicateNodes, getGroupDescendantIds, groupNodes, updateNode } from "@/core/mutations";
import { downloadProjectFile } from "@/io/fileDialogs";

export function attachKeyboardShortcuts(projectStore: HistoryStore, viewStore: Store<ViewState>): void {
  window.addEventListener("keydown", (e) => {
    const target = e.target as HTMLElement;
    const isEditableField = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    // Always intercepted, even while a panel field is focused - otherwise the browser's save-page dialog opens instead.
    if (mod && key === "s") {
      e.preventDefault();
      downloadProjectFile(projectStore.get());
      return;
    }

    if (isEditableField) return; // don't hijack typing in panel inputs or the text-edit overlay

    const view = viewStore.get();
    const selected = view.selectedIds;

    if (mod && key === "z") {
      e.preventDefault();
      if (e.shiftKey) projectStore.redo();
      else projectStore.undo();
      return;
    }
    if (mod && key === "y") {
      e.preventDefault();
      projectStore.redo();
      return;
    }
    if (mod && key === "d") {
      e.preventDefault();
      if (selected.length === 0) return;
      const { project, newIds } = duplicateNodes(projectStore.get(), selected);
      projectStore.patch(project);
      viewStore.patch({ ...view, selectedIds: newIds });
      return;
    }
    if (mod && key === "g") {
      e.preventDefault();
      if (selected.length < 2) return;
      projectStore.update((p) => groupNodes(p, selected));
      const order = projectStore.get().order;
      viewStore.patch({ ...view, selectedIds: [order[order.length - 1]] });
      return;
    }
    if (key === "delete" || key === "backspace") {
      if (selected.length === 0) return;
      e.preventDefault();
      projectStore.update((p) => deleteNodes(p, selected));
      viewStore.patch({ ...view, selectedIds: [] });
      return;
    }
    if (key.startsWith("arrow")) {
      if (selected.length === 0) return;
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const dx = key === "arrowleft" ? -step : key === "arrowright" ? step : 0;
      const dy = key === "arrowup" ? -step : key === "arrowdown" ? step : 0;
      const project = projectStore.get();
      const moveIds = new Set<string>();
      for (const id of selected) {
        for (const leafId of getGroupDescendantIds(project, id)) moveIds.add(leafId);
      }
      projectStore.update((p) => {
        let next = p;
        for (const id of moveIds) {
          const node = next.nodes[id];
          if (!node) continue;
          next = updateNode(next, id, { transform: { ...node.transform, x: node.transform.x + dx, y: node.transform.y + dy } });
        }
        return next;
      });
    }
  });
}
