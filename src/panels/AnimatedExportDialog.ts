import type { Project } from "@/core/model";
import { recordWebM, downloadBlob } from "@/export/videoRecorder";
import { transcodeWebMToMp4, transcodeWebMToAnimatedWebP } from "@/export/ffmpegTranscode";
import type { Exportables } from "./ExportPanel";

export function mountAnimatedExportButton(parent: HTMLElement, getExportables: () => Exportables): HTMLElement {
  const button = document.createElement("button");
  button.id = "animate-export-btn";
  button.title = "Export animated video (WebM / MP4 / animated WebP)";
  button.textContent = "Export Video";
  parent.appendChild(button);

  let overlay: HTMLDivElement | null = null;

  button.addEventListener("click", () => openDialog());

  function openDialog() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal-dialog">
        <h3>Export Animated Diagram</h3>
        <label class="field">Duration (s)<input type="number" id="anim-duration" min="0.5" max="30" step="0.5" value="3"></label>
        <label class="field">FPS<input type="number" id="anim-fps" min="6" max="60" value="24"></label>
        <label class="field">Scale
          <select id="anim-scale">
            <option value="1">1x</option>
            <option value="2">2x</option>
          </select>
        </label>
        <label class="field">Loop (WebP)<input type="checkbox" id="anim-loop" checked></label>
        <div class="field-group">
          <label class="checkbox-row"><input type="checkbox" id="fmt-webm" checked> WebM</label>
          <label class="checkbox-row"><input type="checkbox" id="fmt-mp4"> MP4</label>
          <label class="checkbox-row"><input type="checkbox" id="fmt-webp"> Animated WebP</label>
        </div>
        <div id="anim-progress-wrap" class="progress-wrap hidden">
          <div class="progress-bar"><div id="anim-progress-fill" class="progress-fill"></div></div>
          <div id="anim-status" class="note-text">Preparing…</div>
        </div>
        <div class="modal-actions">
          <button id="anim-cancel" class="secondary-btn">Close</button>
          <button id="anim-start">Start Export</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector("#anim-cancel")!.addEventListener("click", closeDialog);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeDialog();
    });
    overlay.querySelector("#anim-start")!.addEventListener("click", () => void runExport());
  }

  function closeDialog() {
    overlay?.remove();
    overlay = null;
  }

  function setStatus(fraction: number, text: string) {
    if (!overlay) return;
    overlay.querySelector<HTMLDivElement>("#anim-progress-wrap")!.classList.remove("hidden");
    overlay.querySelector<HTMLDivElement>("#anim-progress-fill")!.style.width = `${Math.round(fraction * 100)}%`;
    overlay.querySelector<HTMLDivElement>("#anim-status")!.textContent = text;
  }

  async function runExport() {
    if (!overlay) return;
    const durationSeconds = Number(overlay.querySelector<HTMLInputElement>("#anim-duration")!.value);
    const fps = Number(overlay.querySelector<HTMLInputElement>("#anim-fps")!.value);
    const scale = Number(overlay.querySelector<HTMLSelectElement>("#anim-scale")!.value);
    const loop = overlay.querySelector<HTMLInputElement>("#anim-loop")!.checked;
    const wantWebm = overlay.querySelector<HTMLInputElement>("#fmt-webm")!.checked;
    const wantMp4 = overlay.querySelector<HTMLInputElement>("#fmt-mp4")!.checked;
    const wantWebp = overlay.querySelector<HTMLInputElement>("#fmt-webp")!.checked;

    overlay.querySelector<HTMLButtonElement>("#anim-start")!.disabled = true;
    const { project, stageDefs, contentRoot } = getExportables();

    setStatus(0, "Recording frames…");
    const webmBlob = await recordWebM(project as Project, stageDefs, contentRoot, { durationSeconds, fps, scale }, (f) =>
      setStatus(f * 0.5, `Recording frames… ${Math.round(f * 100)}%`)
    );

    if (wantWebm) downloadBlob(webmBlob, "diagram.webm");

    if (wantMp4) {
      setStatus(0.5, "Loading ffmpeg (one-time, ~30MB)…");
      const mp4Blob = await transcodeWebMToMp4(webmBlob, (f) => setStatus(0.5 + f * 0.25, `Transcoding to MP4… ${Math.round(f * 100)}%`));
      downloadBlob(mp4Blob, "diagram.mp4");
    }

    if (wantWebp) {
      setStatus(wantMp4 ? 0.75 : 0.5, "Loading ffmpeg (one-time, ~30MB)…");
      const webpBlob = await transcodeWebMToAnimatedWebP(webmBlob, loop, (f) =>
        setStatus((wantMp4 ? 0.75 : 0.5) + f * 0.25, `Transcoding to animated WebP… ${Math.round(f * 100)}%`)
      );
      downloadBlob(webpBlob, "diagram.webp");
    }

    setStatus(1, "Done.");
    overlay.querySelector<HTMLButtonElement>("#anim-start")!.disabled = false;
  }

  return button;
}
