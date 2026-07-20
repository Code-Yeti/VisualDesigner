import type { NodeId, Project, SceneNode } from "./model";

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
