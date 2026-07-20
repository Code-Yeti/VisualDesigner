import type { Project } from "@/core/model";
import { dashKeyframeCSS } from "@/core/dashPattern";
import { SVG_NS } from "@/render/svgUtil";

// Re-embedded here because the exported file is opened standalone, with no
// access to the app's own stylesheet.
const BASE_STYLE = `.dash-ants { animation-timing-function: linear; animation-iteration-count: infinite; }`;

/**
 * Each marching-ants element carries its own `data-dash-repeat` (see
 * `computeDashRepeatLength` and `render/dashKeyframes.ts`'s `ensureDashKeyframe`,
 * whose live document.head-injected rules this exported file has no access
 * to) and references its matching `@keyframes` rule by name via inline
 * `animation-name`. Rather than embed every rule the live app has ever
 * generated, scan the actual exported content for which repeat lengths are
 * in play and embed only those.
 */
function buildDashKeyframesStyle(exportedContent: Element): string {
  const repeats = new Set<number>();
  exportedContent.querySelectorAll("[data-dash-repeat]").forEach((el) => {
    const value = parseFloat(el.getAttribute("data-dash-repeat") ?? "");
    if (!Number.isNaN(value)) repeats.add(value);
  });
  return [...repeats].map(dashKeyframeCSS).join(" ");
}

/**
 * Builds a standalone SVG element from the real stage DOM (defs + content
 * root only - #overlay, which holds the grid/handles/marquee, is never
 * referenced here, so there is no code path that could leak it into the
 * export). Returned as a live element (not yet serialized) so callers like
 * the animation frame sampler can patch per-frame state before stringifying.
 */
export function buildExportSVGElement(project: Project, stageDefs: SVGDefsElement, contentRoot: SVGGElement): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("viewBox", `0 0 ${project.canvas.width} ${project.canvas.height}`);
  svg.setAttribute("width", String(project.canvas.width));
  svg.setAttribute("height", String(project.canvas.height));

  const clonedContent = contentRoot.cloneNode(true) as SVGGElement;

  const style = document.createElementNS(SVG_NS, "style");
  style.textContent = `${BASE_STYLE}\n${buildDashKeyframesStyle(clonedContent)}`;
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
  svg.appendChild(clonedContent);

  return svg;
}

export function exportProjectToSVGString(project: Project, stageDefs: SVGDefsElement, contentRoot: SVGGElement): string {
  return new XMLSerializer().serializeToString(buildExportSVGElement(project, stageDefs, contentRoot));
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
