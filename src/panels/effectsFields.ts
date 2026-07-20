import type { FilterDef } from "@/core/model";

export function effectsFieldsHtml(prefix: string, filter: FilterDef | undefined): string {
  const on = !!filter;
  const dx = filter?.dx ?? 0;
  const dy = filter?.dy ?? 3;
  const blur = filter?.blur ?? 3.5;
  const color = filter?.color ?? "#1e293b";
  const opacity = filter?.opacity ?? 0.16;
  return `
    <h3 class="section-heading">Effects</h3>
    <label class="field">Drop shadow<input type="checkbox" id="${prefix}-shadow-on" ${on ? "checked" : ""}></label>
    ${
      on
        ? `
      <label class="field">Offset X<input type="number" id="${prefix}-shadow-dx" step="0.5" value="${dx}"></label>
      <label class="field">Offset Y<input type="number" id="${prefix}-shadow-dy" step="0.5" value="${dy}"></label>
      <label class="field">Blur<input type="number" id="${prefix}-shadow-blur" min="0" step="0.5" value="${blur}"></label>
      <label class="field">Color<input type="color" id="${prefix}-shadow-color" value="${color}"></label>
      <label class="field">Opacity<input type="range" id="${prefix}-shadow-opacity" min="0" max="1" step="0.01" value="${opacity}"></label>
    `
        : ""
    }
  `;
}

export function bindEffectsFields(
  panel: HTMLElement,
  prefix: string,
  onToggle: (enabled: boolean) => void,
  onChange: (patch: Partial<Omit<FilterDef, "id" | "kind">>) => void
): void {
  panel.querySelector<HTMLInputElement>(`#${prefix}-shadow-on`)!.addEventListener("change", (e) => {
    onToggle((e.target as HTMLInputElement).checked);
  });
  panel.querySelector<HTMLInputElement>(`#${prefix}-shadow-dx`)?.addEventListener("input", (e) => {
    onChange({ dx: Number((e.target as HTMLInputElement).value) });
  });
  panel.querySelector<HTMLInputElement>(`#${prefix}-shadow-dy`)?.addEventListener("input", (e) => {
    onChange({ dy: Number((e.target as HTMLInputElement).value) });
  });
  panel.querySelector<HTMLInputElement>(`#${prefix}-shadow-blur`)?.addEventListener("input", (e) => {
    onChange({ blur: Number((e.target as HTMLInputElement).value) });
  });
  panel.querySelector<HTMLInputElement>(`#${prefix}-shadow-color`)?.addEventListener("input", (e) => {
    onChange({ color: (e.target as HTMLInputElement).value });
  });
  panel.querySelector<HTMLInputElement>(`#${prefix}-shadow-opacity`)?.addEventListener("input", (e) => {
    onChange({ opacity: Number((e.target as HTMLInputElement).value) });
  });
}
