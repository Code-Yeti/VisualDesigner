import type { Project } from "@/core/model";
import { PROJECT_VERSION } from "@/core/model";

export function serializeProject(project: Project): string {
  return JSON.stringify(project, null, 2);
}

/** No prior schema versions exist yet; this is the seam future migrations hang off of. */
export function deserializeProject(json: string): Project {
  const data = JSON.parse(json) as Project;
  if (typeof data.version !== "number" || !data.canvas || !data.nodes || !data.order) {
    throw new Error("Not a valid VisualDesigner project file.");
  }
  if (data.version !== PROJECT_VERSION) {
    console.warn(`Project file version ${data.version} differs from current ${PROJECT_VERSION}; loading as-is.`);
  }
  return data;
}
