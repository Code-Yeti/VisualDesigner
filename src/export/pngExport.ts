import type { Project } from "@/core/model";
import { exportProjectToSVGString } from "./svgExport";

export async function exportProjectToPNGBlob(
  project: Project,
  stageDefs: SVGDefsElement,
  contentRoot: SVGGElement,
  scale = 1
): Promise<Blob> {
  const svgString = exportProjectToSVGString(project, stageDefs, contentRoot);
  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to rasterize SVG for PNG export."));
      img.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(project.canvas.width * scale);
    canvas.height = Math.round(project.canvas.height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("canvas.toBlob returned null."))), "image/png");
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function downloadPNG(
  project: Project,
  stageDefs: SVGDefsElement,
  contentRoot: SVGGElement,
  scale = 1,
  filename = "diagram.png"
): Promise<void> {
  const blob = await exportProjectToPNGBlob(project, stageDefs, contentRoot, scale);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
