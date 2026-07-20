import type { ConnectorNode, GroupNode, NodeId, Project, SceneNode } from "./model";
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

/**
 * Pastes a clipboard snapshot with fresh ids, offset from the copied
 * position (increasing with `offset` for repeated pastes). New ids for
 * every entry (including group descendants) are assigned into one shared
 * map up front, so a connector copied alongside its endpoint shapes is
 * rewired to the *pasted* copies instead of staying attached to whatever
 * shapes are currently in the live project - a connector whose endpoint
 * wasn't part of the copied selection simply keeps pointing at the
 * original, unchanged.
 */
export function pasteClipboard(project: Project, clipboard: Clipboard, offset: number): { project: Project; newIds: NodeId[] } {
  const idMap = new Map<NodeId, NodeId>();
  for (const entry of clipboard.entries) {
    idMap.set(entry.root.id, nextId(entry.root.type));
    for (const child of entry.descendants) idMap.set(child.id, nextId(child.type));
  }

  function cloneNode(node: SceneNode, newId: NodeId, newParentId: NodeId | null): SceneNode {
    if (node.type === "connector") {
      const connector = node as ConnectorNode;
      return {
        ...connector,
        id: newId,
        parentId: newParentId,
        source: { ...connector.source, nodeId: idMap.get(connector.source.nodeId) ?? connector.source.nodeId },
        target: { ...connector.target, nodeId: idMap.get(connector.target.nodeId) ?? connector.target.nodeId },
      };
    }
    if (node.type === "group") {
      const group = node as GroupNode;
      return { ...group, id: newId, parentId: newParentId, childIds: group.childIds.map((cid) => idMap.get(cid) ?? cid) };
    }
    return {
      ...node,
      id: newId,
      parentId: newParentId,
      transform: { ...node.transform, x: node.transform.x + offset, y: node.transform.y + offset },
    };
  }

  let next = project;
  const newIds: NodeId[] = [];

  for (const entry of clipboard.entries) {
    const newRootId = idMap.get(entry.root.id)!;

    if (entry.root.type === "group") {
      for (const child of entry.descendants) {
        const newChildId = idMap.get(child.id)!;
        const clone = cloneNode(child, newChildId, newRootId);
        next = { ...next, nodes: { ...next.nodes, [newChildId]: clone }, order: [...next.order, newChildId] };
      }
    }

    const rootClone = cloneNode(entry.root, newRootId, null);
    next = { ...next, nodes: { ...next.nodes, [newRootId]: rootClone }, order: [...next.order, newRootId] };
    newIds.push(newRootId);
  }

  return { project: next, newIds };
}
