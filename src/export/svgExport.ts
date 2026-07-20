import type { Project } from "@/core/model";
import { SVG_NS } from "@/render/svgUtil";

// Re-embedded here because the exported file is opened standalone, with no
// access to the app's own stylesheet.
const EMBEDDED_STYLE = `
  @keyframes connector-march { to { stroke-dashoffset: -19; } }
  .connector-ants { animation-name: connector-march; animation-timing-function: linear; animation-iteration-count: infinite; }
`;

/**
 * Builds a standalone SVG string from the real stage DOM (defs + content
 * root only - #overlay, which holds the grid/handles/marquee, is never
 * referenced here, so there is no code path that could leak it into the
 * export).
 */
export function exportProjectToSVGString(project: Project, stageDefs: SVGDefsElement, contentRoot: SVGGElement): string {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("viewBox", `0 0 ${project.canvas.width} ${project.canvas.height}`);
  svg.setAttribute("width", String(project.canvas.width));
  svg.setAttribute("height", String(project.canvas.height));

  const style = document.createElementNS(SVG_NS, "style");
  style.textContent = EMBEDDED_STYLE;
  svg.appendChild(style);

  if (project.canvas.background) {
    const bg = document.createElementNS(SVG_NS, "rect");
    bg.setAttribute("x", "0");
    bg.setAttribute("y", "0");
    bg.setAttribute("width", String(project.canvas.width));
    bg.setAttribute("height", String(project.canvas.height));
    bg.setAttribute("fill", project.canvas.background);
    svg.appendChild(bg);
  }

  svg.appendChild(stageDefs.cloneNode(true));
  svg.appendChild(contentRoot.cloneNode(true));

  return new XMLSerializer().serializeToString(svg);
}

export function downloadSVG(project: Project, stageDefs: SVGDefsElement, contentRoot: SVGGElement, filename = "diagram.svg"): void {
  const svgString = exportProjectToSVGString(project, stageDefs, contentRoot);
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
