import type { Project } from "@/core/model";
import { downloadSVG } from "@/export/svgExport";
import { downloadPNG } from "@/export/pngExport";

export interface Exportables {
  project: Project;
  stageDefs: SVGDefsElement;
  contentRoot: SVGGElement;
}

export function mountExportMenu(parent: HTMLElement, getExportables: () => Exportables): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "export-menu-wrapper";
  wrapper.innerHTML = `
    <button id="export-toggle" title="Export static image">Export &#9662;</button>
    <div id="export-dropdown" class="export-dropdown hidden">
      <button id="export-svg-btn" class="secondary-btn">Export SVG</button>
      <label class="field">PNG scale
        <select id="export-png-scale">
          <option value="1">1x</option>
          <option value="2" selected>2x</option>
          <option value="3">3x</option>
        </select>
      </label>
      <button id="export-png-btn" class="secondary-btn">Export PNG</button>
    </div>
  `;
  parent.appendChild(wrapper);

  const dropdown = wrapper.querySelector<HTMLDivElement>("#export-dropdown")!;

  wrapper.querySelector("#export-toggle")!.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("hidden");
  });
  document.addEventListener("click", (e) => {
    if (!wrapper.contains(e.target as Node)) dropdown.classList.add("hidden");
  });

  wrapper.querySelector("#export-svg-btn")!.addEventListener("click", () => {
    const { project, stageDefs, contentRoot } = getExportables();
    downloadSVG(project, stageDefs, contentRoot);
    dropdown.classList.add("hidden");
  });

  wrapper.querySelector("#export-png-btn")!.addEventListener("click", async () => {
    const { project, stageDefs, contentRoot } = getExportables();
    const scale = Number(wrapper.querySelector<HTMLSelectElement>("#export-png-scale")!.value);
    await downloadPNG(project, stageDefs, contentRoot, scale);
    dropdown.classList.add("hidden");
  });

  return wrapper;
}
