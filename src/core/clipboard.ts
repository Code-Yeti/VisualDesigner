import type { GroupNode, NodeId, Project, SceneNode } from "./model";
import { nextId } from "./ids";
import { getGroupDescendantIds } from "./mutations";

export interface ClipboardEntry {
  root: SceneNode;
  /** Populated only when root is a group: deep copies of its members. */
  descendants: SceneNode[];
}

export interface Clipboard {
  entries: ClipboardEntry[];
}

/** Snapshots the selected nodes (expanding groups to include their members) as plain data fully detached from the live project. */
export function copyNodes(project: Project, ids: NodeId[]): Clipboard {
  const entries: ClipboardEntry[] = [];
  for (const id of ids) {
    const node = project.nodes[id];
    if (!node) continue;
    if (node.type === "group") {
      const descendants = getGroupDescendantIds(project, id)
        .map((cid) => project.nodes[cid])
        .filter((n): n is SceneNode => !!n)
        .map((n) => structuredClone(n));
      entries.push({ root: structuredClone(node), descendants });
    } else {
      entries.push({ root: structuredClone(node), descendants: [] });
    }
  }
  return { entries };
}

/** Pastes a clipboard snapshot with fresh ids, offset from the copied position (increasing with `offset` for repeated pastes). */
export function pasteClipboard(project: Project, clipboard: Clipboard, offset: number): { project: Project; newIds: NodeId[] } {
  let next = project;
  const newIds: NodeId[] = [];

  for (const entry of clipboard.entries) {
    if (entry.root.type === "group") {
      const idMap = new Map<NodeId, NodeId>();
      for (const child of entry.descendants) idMap.set(child.id, nextId(child.type));

      for (const child of entry.descendants) {
        const newChildId = idMap.get(child.id)!;
        const clone: SceneNode = {
          ...child,
          id: newChildId,
          parentId: null,
          transform: { ...child.transform, x: child.transform.x + offset, y: child.transform.y + offset },
        };
        next = { ...next, nodes: { ...next.nodes, [newChildId]: clone }, order: [...next.order, newChildId] };
      }

      const newGroupId = nextId("group");
      const newGroup: GroupNode = { ...(entry.root as GroupNode), id: newGroupId, childIds: [...idMap.values()] };
      next = { ...next, nodes: { ...next.nodes, [newGroupId]: newGroup }, order: [...next.order, newGroupId] };
      for (const newChildId of idMap.values()) {
        next = { ...next, nodes: { ...next.nodes, [newChildId]: { ...next.nodes[newChildId], parentId: newGroupId } } };
      }
      newIds.push(newGroupId);
    } else {
      const newId = nextId(entry.root.type);
      const clone: SceneNode = {
        ...entry.root,
        id: newId,
        parentId: null,
        transform: { ...entry.root.transform, x: entry.root.transform.x + offset, y: entry.root.transform.y + offset },
      };
      next = { ...next, nodes: { ...next.nodes, [newId]: clone }, order: [...next.order, newId] };
      newIds.push(newId);
    }
  }

  return { project: next, newIds };
}
