import type { FontStyle } from "@/core/model";

export const FONT_FAMILIES = [
  "Segoe UI, Tahoma, Geneva, Verdana, sans-serif",
  "Arial, Helvetica, sans-serif",
  "Georgia, serif",
  "Times New Roman, Times, serif",
  "Courier New, monospace",
  "Trebuchet MS, sans-serif",
  "Verdana, Geneva, sans-serif",
];

export function fontFieldsHtml(prefix: string, font: FontStyle, fillColor: string): string {
  const familyOptions = FONT_FAMILIES.map(
    (f) => `<option value="${f}" ${f === font.family ? "selected" : ""}>${f.split(",")[0]}</option>`
  ).join("");
  return `
    <label class="field">Font<select id="${prefix}-family">${familyOptions}</select></label>
    <label class="field">Size<input type="number" id="${prefix}-size" min="6" max="120" value="${font.size}"></label>
    <label class="field">Color<input type="color" id="${prefix}-color" value="${fillColor}"></label>
    <label class="field">Bold<input type="checkbox" id="${prefix}-bold" ${font.weight === "bold" ? "checked" : ""}></label>
    <label class="field">Italic<input type="checkbox" id="${prefix}-italic" ${font.italic ? "checked" : ""}></label>
    <label class="field">Letter spacing<input type="number" id="${prefix}-ls" step="0.1" value="${font.letterSpacing}"></label>
    <label class="field">Align
      <select id="${prefix}-align">
        <option value="start" ${font.align === "start" ? "selected" : ""}>Left</option>
        <option value="middle" ${font.align === "middle" ? "selected" : ""}>Center</option>
        <option value="end" ${font.align === "end" ? "selected" : ""}>Right</option>
      </select>
    </label>
  `;
}

export function bindFontFields(
  panel: HTMLElement,
  prefix: string,
  onFontChange: (patch: Partial<FontStyle>) => void,
  onFillChange: (color: string) => void
): void {
  panel.querySelector<HTMLSelectElement>(`#${prefix}-family`)!.addEventListener("change", (e) => {
    onFontChange({ family: (e.target as HTMLSelectElement).value });
  });
  panel.querySelector<HTMLInputElement>(`#${prefix}-size`)!.addEventListener("input", (e) => {
    onFontChange({ size: Number((e.target as HTMLInputElement).value) });
  });
  panel.querySelector<HTMLInputElement>(`#${prefix}-color`)!.addEventListener("input", (e) => {
    onFillChange((e.target as HTMLInputElement).value);
  });
  panel.querySelector<HTMLInputElement>(`#${prefix}-bold`)!.addEventListener("change", (e) => {
    onFontChange({ weight: (e.target as HTMLInputElement).checked ? "bold" : "normal" });
  });
  panel.querySelector<HTMLInputElement>(`#${prefix}-italic`)!.addEventListener("change", (e) => {
    onFontChange({ italic: (e.target as HTMLInputElement).checked });
  });
  panel.querySelector<HTMLInputElement>(`#${prefix}-ls`)!.addEventListener("input", (e) => {
    onFontChange({ letterSpacing: Number((e.target as HTMLInputElement).value) });
  });
  panel.querySelector<HTMLSelectElement>(`#${prefix}-align`)!.addEventListener("change", (e) => {
    onFontChange({ align: (e.target as HTMLSelectElement).value as FontStyle["align"] });
  });
}
