import type { Project } from "@/core/model";
import { buildFrameSVGString, rasterizeSVGStringToCanvas } from "./frameSampler";

export interface RecordOptions {
  durationSeconds: number;
  fps: number;
  scale: number;
}

function pickMimeType(): string {
  const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "video/webm";
}

/**
 * Draws each baked frame to a canvas, real-time-paced to the target fps, and
 * records the canvas's MediaStream. captureStream(fps) samples the canvas
 * periodically regardless of exactly when we draw, so pacing our draws to
 * match fps (rather than drawing as fast as possible) keeps the recording
 * close to the intended frame timing.
 */
export async function recordWebM(
  project: Project,
  stageDefs: SVGDefsElement,
  contentRoot: SVGGElement,
  options: RecordOptions,
  onProgress?: (fraction: number) => void
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(project.canvas.width * options.scale);
  canvas.height = Math.round(project.canvas.height * options.scale);

  const totalFrames = Math.max(1, Math.round(options.durationSeconds * options.fps));
  // Draw the first frame before starting capture so the recording doesn't open on a blank canvas.
  await rasterizeSVGStringToCanvas(buildFrameSVGString(project, stageDefs, contentRoot, 0), canvas);

  const stream = canvas.captureStream(options.fps);
  const recorder = new MediaRecorder(stream, { mimeType: pickMimeType() });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const stopped = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
  });

  recorder.start();
  const frameIntervalMs = 1000 / options.fps;
  const startTime = performance.now();

  for (let i = 0; i < totalFrames; i++) {
    const t = i / options.fps;
    await rasterizeSVGStringToCanvas(buildFrameSVGString(project, stageDefs, contentRoot, t), canvas);
    onProgress?.((i + 1) / totalFrames);

    const targetElapsed = (i + 1) * frameIntervalMs;
    const actualElapsed = performance.now() - startTime;
    const waitMs = targetElapsed - actualElapsed;
    if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
  }

  recorder.stop();
  stream.getTracks().forEach((track) => track.stop());
  return stopped;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
