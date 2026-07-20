import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

let instance: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;

/**
 * Lazily loads a single shared FFmpeg instance from the locally-bundled,
 * single-threaded core (public/ffmpeg/) - single-threaded avoids the
 * COOP/COEP cross-origin-isolation headers the multithreaded core requires,
 * which a plain static host wouldn't provide. Only loaded on first actual
 * MP4/WebP export request, not on app startup.
 *
 * Test MP4/WebP export against a production build (`npm run build && npm run
 * preview`), not `npm run dev`: the ffmpeg.wasm package spawns its own
 * module worker internally, and Vite's dev-server transform of that specific
 * worker chunk hangs load() indefinitely with no error in dev mode. The
 * production build's worker bundling doesn't have this issue.
 */
export async function getFFmpeg(): Promise<FFmpeg> {
  if (instance) return instance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const ffmpeg = new FFmpeg();
    // toBlobURL pre-fetches each file and hands the worker a same-origin
    // blob: URL instead of a path - ffmpeg-core.js resolves its sibling
    // .wasm relative to its own script location internally, and that
    // resolution doesn't cross the worker boundary correctly when given a
    // plain path, silently hanging load() with no error.
    const [coreURL, wasmURL] = await Promise.all([
      toBlobURL("/ffmpeg/ffmpeg-core.js", "text/javascript"),
      toBlobURL("/ffmpeg/ffmpeg-core.wasm", "application/wasm"),
    ]);
    await ffmpeg.load({ coreURL, wasmURL });
    instance = ffmpeg;
    return ffmpeg;
  })();

  return loadingPromise;
}
