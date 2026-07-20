import type { Store } from "@/core/store";
import type { Project } from "@/core/model";
import { serializeProject, deserializeProject } from "./projectFile";

const AUTOSAVE_KEY = "visualdesigner:autosave";
const DEBOUNCE_MS = 800;

export function attachAutosave(projectStore: Store<Project>): void {
  let timer: number | undefined;
  projectStore.subscribe((project) => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      try {
        localStorage.setItem(AUTOSAVE_KEY, serializeProject(project));
      } catch {
        // Storage quota exceeded or unavailable (e.g. private browsing) - autosave is best-effort.
      }
    }, DEBOUNCE_MS);
  });
}

export function loadAutosave(): Project | null {
  const raw = localStorage.getItem(AUTOSAVE_KEY);
  if (!raw) return null;
  try {
    return deserializeProject(raw);
  } catch {
    return null;
  }
}

export function clearAutosave(): void {
  localStorage.removeItem(AUTOSAVE_KEY);
}
