import type { Project } from "@/core/model";
import { serializeProject, deserializeProject } from "./projectFile";

export function downloadProjectFile(project: Project, filename = "diagram.json"): void {
  const blob = new Blob([serializeProject(project)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function openProjectFilePicker(onLoad: (project: Project) => void, onError: (message: string) => void): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        onLoad(deserializeProject(String(reader.result)));
      } catch (e) {
        onError((e as Error).message);
      }
    };
    reader.readAsText(file);
  });
  input.click();
}
