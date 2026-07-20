export const SVG_NS = "http://www.w3.org/2000/svg";

export function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number | undefined> = {}
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  setAttrs(el, attrs);
  return el;
}

export function setAttrs(el: SVGElement, attrs: Record<string, string | number | undefined>): void {
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined) {
      el.removeAttribute(key);
    } else {
      el.setAttribute(key, String(value));
    }
  }
}
