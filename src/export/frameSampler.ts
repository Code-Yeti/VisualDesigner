import type { Project } from "@/core/model";
import { buildExportSVGElement } from "./svgExport";

/**
 * Bakes the marching-ants animation state for a given virtual time into a
 * static stroke-dashoffset, instead of relying on the browser's live CSS
 * animation clock. This is what makes frame capture deterministic - the same
 * time always produces the same pixels, so a recording's frame N doesn't
 * depend on how fast the machine happened to run at capture time, and looped
 * playback seams cleanly (frame 0 and frame N-1 are exactly one dash cycle
 * apart for elements whose animationSeconds divides the loop duration).
 * Applies to both connector strokes and animated shape strokes - both use
 * the same `.dash-ants` class.
 */
function bakeAnimationState(svg: SVGSVGElement, timeSeconds: number): void {
  const animatedEls = svg.querySelectorAll<SVGGraphicsElement>(".dash-ants");
  animatedEls.forEach((el) => {
    const styleAttr = el.getAttribute("style") ?? "";
    const durationMatch = /animation-duration:\s*([\d.]+)s/.exec(styleAttr);
    const duration = durationMatch ? parseFloat(durationMatch[1]) : 1;
    // Each element carries its own --dash-repeat (see computeDashRepeatLength) -
    // using a single constant here would re-introduce the same seam-jump bug
    // the live CSS keyframe fixes: it only looks seamless when this exactly
    // matches that element's actual dash+gap repeat length.
    const repeatMatch = /--dash-repeat:\s*([\d.]+)/.exec(styleAttr);
    const dashRepeat = repeatMatch ? parseFloat(repeatMatch[1]) : 19;
    const progress = (timeSeconds % duration) / duration;
    el.style.animation = "none";
    el.style.strokeDashoffset = String(-dashRepeat * progress);
  });
}

export function buildFrameSVGString(project: Project, stageDefs: SVGDefsElement, contentRoot: SVGGElement, timeSeconds: number): string {
  const svg = buildExportSVGElement(project, stageDefs, contentRoot);
  bakeAnimationState(svg, timeSeconds);
  return new XMLSerializer().serializeToString(svg);
}

/** Rasterizes an SVG string onto an existing canvas at the canvas's current pixel size. */
export async function rasterizeSVGStringToCanvas(svgString: string, canvas: HTMLCanvasElement): Promise<void> {
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to rasterize animation frame."));
      img.src = url;
    });
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  } finally {
    URL.revokeObjectURL(url);
  }
}
