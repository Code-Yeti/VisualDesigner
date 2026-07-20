import { getFFmpeg } from "./ffmpegClient";

async function withProgress<T>(onProgress: ((fraction: number) => void) | undefined, run: () => Promise<T>): Promise<T> {
  const ffmpeg = await getFFmpeg();
  const handler = onProgress ? ({ progress }: { progress: number }) => onProgress(Math.min(1, Math.max(0, progress))) : undefined;
  if (handler) ffmpeg.on("progress", handler);
  try {
    return await run();
  } finally {
    if (handler) ffmpeg.off("progress", handler);
  }
}

/** Transcodes a recorded WebM into MP4 entirely client-side via ffmpeg.wasm. */
export async function transcodeWebMToMp4(webmBlob: Blob, onProgress?: (fraction: number) => void): Promise<Blob> {
  return withProgress(onProgress, async () => {
    const ffmpeg = await getFFmpeg();
    const input = new Uint8Array(await webmBlob.arrayBuffer());
    await ffmpeg.writeFile("input.webm", input);
    await ffmpeg.exec(["-i", "input.webm", "-pix_fmt", "yuv420p", "output.mp4"]);
    const data = await ffmpeg.readFile("output.mp4");
    await ffmpeg.deleteFile("input.webm");
    await ffmpeg.deleteFile("output.mp4");
    return new Blob([data as unknown as BlobPart], { type: "video/mp4" });
  });
}

/** Transcodes a recorded WebM into an animated WebP via ffmpeg.wasm's libwebp encoder. */
export async function transcodeWebMToAnimatedWebP(webmBlob: Blob, loop = true, onProgress?: (fraction: number) => void): Promise<Blob> {
  return withProgress(onProgress, async () => {
    const ffmpeg = await getFFmpeg();
    const input = new Uint8Array(await webmBlob.arrayBuffer());
    await ffmpeg.writeFile("input.webm", input);
    await ffmpeg.exec(["-i", "input.webm", "-vcodec", "libwebp", "-loop", loop ? "0" : "1", "-an", "-vsync", "0", "output.webp"]);
    const data = await ffmpeg.readFile("output.webp");
    await ffmpeg.deleteFile("input.webm");
    await ffmpeg.deleteFile("output.webp");
    return new Blob([data as unknown as BlobPart], { type: "image/webp" });
  });
}
