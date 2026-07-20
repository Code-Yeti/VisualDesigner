import type { CanvasConfig, ConnectorNode, FilterDef, GradientDef, GroupNode, NodeId, Project, SceneNode } from "./model";
import { defaultTransform } from "./model";
import { nextId } from "./ids";

export function addNode(project: Project, node: SceneNode): Project {
  return {
    ...project,
    nodes: { ...project.nodes, [node.id]: node },
    order: [...project.order, node.id],
  };
}

export function removeNode(project: Project, id: NodeId): Project {
  const nodes = { ...project.nodes };
  delete nodes[id];
  return { ...project, nodes, order: project.order.filter((x) => x !== id) };
}

export function updateCanvasConfig(project: Project, patch: Partial<CanvasConfig>): Project {
  return { ...project, canvas: { ...project.canvas, ...patch } };
}

export function upsertGradientDef(project: Project, def: GradientDef): Project {
  const gradients = [...project.defs.gradients.filter((g) => g.id !== def.id), def];
  return { ...project, defs: { ...project.defs, gradients } };
}

export function upsertFilterDef(project: Project, def: FilterDef): Project {
  const filters = [...project.defs.filters.filter((f) => f.id !== def.id), def];
  return { ...project, defs: { ...project.defs, filters } };
}

/** Removes a node along with any connectors that reference it, so deleting a shape doesn't leave dangling connectors. */
export function removeNodeCascade(project: Project, id: NodeId): Project {
  let next = removeNode(project, id);
  const dangling = next.order.filter((oid) => {
    const n = next.nodes[oid];
    return n?.type === "connector" && (n.source.nodeId === id || n.target.nodeId === id);
  });
  for (const cid of dangling) next = removeNode(next, cid);
  return next;
}

/**
 * Shallow-merges `patch` onto the existing node. Typed loosely (patch keys
 * are trusted to belong to the node's actual variant) since SceneNode is a
 * discriminated union and Partial<SceneNode> doesn't distribute usefully
 * for callers merging a handful of known fields (e.g. `transform`, `style`).
 */
export function updateNode(project: Project, id: NodeId, patch: Record<string, unknown>): Project {
  const existing = project.nodes[id];
  if (!existing) return project;
  return {
    ...project,
    nodes: { ...project.nodes, [id]: { ...existing, ...patch } as SceneNode },
  };
}

/** Moves `id` to `newIndex` within the top-level paint-order array. */
export function reorderNode(project: Project, id: NodeId, newIndex: number): Project {
  const order = project.order.filter((x) => x !== id);
  const clamped = Math.max(0, Math.min(newIndex, order.length));
  order.splice(clamped, 0, id);
  return { ...project, order };
}

export function bringToFront(project: Project, id: NodeId): Project {
  return reorderNode(project, id, project.order.length - 1);
}

export function sendToBack(project: Project, id: NodeId): Project {
  return reorderNode(project, id, 0);
}

export function bringForward(project: Project, id: NodeId): Project {
  const idx = project.order.indexOf(id);
  if (idx === -1) return project;
  return reorderNode(project, id, idx + 1);
}

export function sendBackward(project: Project, id: NodeId): Project {
  const idx = project.order.indexOf(id);
  if (idx <= 0) return project;
  return reorderNode(project, id, idx - 1);
}

/** Walks up parentId chains so acting on a grouped child's id resolves to its topmost group ancestor. */
export function resolveSelectionRoot(project: Project, id: NodeId): NodeId {
  let current = project.nodes[id];
  let rootId = id;
  while (current?.parentId) {
    rootId = current.parentId;
    current = project.nodes[current.parentId];
  }
  return rootId;
}

/** Flattens a group (recursively) down to the leaf shape/text/connector ids it ultimately contains. */
export function getGroupDescendantIds(project: Project, id: NodeId): NodeId[] {
  const node = project.nodes[id];
  if (!node || node.type !== "group") return [id];
  const result: NodeId[] = [];
  for (const childId of (node as GroupNode).childIds) {
    result.push(...getGroupDescendantIds(project, childId));
  }
  return result;
}

/** Groups have no visual geometry of their own in v1 - they're purely a selection/movement container; children keep rendering individually at their existing paint-order position. */
export function groupNodes(project: Project, ids: NodeId[]): Project {
  const groupId = nextId("group");
  const group: GroupNode = {
    id: groupId,
    type: "group",
    name: "Group",
    parentId: null,
    transform: defaultTransform(),
    childIds: ids,
  };
  let next: Project = {
    ...project,
    nodes: { ...project.nodes, [groupId]: group },
    order: [...project.order, groupId],
  };
  for (const id of ids) {
    next = updateNode(next, id, { parentId: groupId });
  }
  return next;
}

export function ungroupNode(project: Project, groupId: NodeId): Project {
  const group = project.nodes[groupId];
  if (!group || group.type !== "group") return project;
  let next = project;
  for (const childId of (group as GroupNode).childIds) {
    next = updateNode(next, childId, { parentId: null });
  }
  return removeNode(next, groupId);
}

/** Deletes each selected id (expanding groups to their members) and cascades to any connectors left dangling. */
export function deleteNodes(project: Project, ids: NodeId[]): Project {
  let next = project;
  for (const id of ids) {
    const node = next.nodes[id];
    if (!node) continue;
    if (node.type === "group") {
      for (const childId of getGroupDescendantIds(next, id)) next = removeNodeCascade(next, childId);
      next = removeNode(next, id);
    } else {
      next = removeNodeCascade(next, id);
    }
  }
  return next;
}

/**
 * Duplicates each selected id (shapes/text get a small offset; groups are
 * reconstructed with fresh child ids) and returns the new top-level ids to
 * select. New ids for every node in the batch (including group descendants)
 * are assigned up front into one shared map, so a connector duplicated
 * alongside its endpoint shapes gets rewired to the *duplicated* copies
 * instead of staying attached to the originals - a connector whose endpoint
 * wasn't part of this batch simply keeps pointing at the original shape,
 * unchanged.
 */
export function duplicateNodes(project: Project, ids: NodeId[]): { project: Project; newIds: NodeId[] } {
  const offset = 20;
  const idMap = new Map<NodeId, NodeId>();

  function assignIds(nodeIds: NodeId[]) {
    for (const id of nodeIds) {
      if (idMap.has(id)) continue;
      const node = project.nodes[id];
      if (!node) continue;
      idMap.set(id, nextId(node.type));
      if (node.type === "group") assignIds((node as GroupNode).childIds);
    }
  }
  assignIds(ids);

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

  function duplicateOne(id: NodeId, newParentId: NodeId | null): NodeId | null {
    const node = project.nodes[id];
    if (!node) return null;
    const newId = idMap.get(id)!;
    if (node.type === "group") {
      for (const childId of (node as GroupNode).childIds) duplicateOne(childId, newId);
    }
    next = addNode(next, cloneNode(node, newId, newParentId));
    return newId;
  }

  for (const id of ids) {
    const newId = duplicateOne(id, null);
    if (newId) newIds.push(newId);
  }

  return { project: next, newIds };
}
