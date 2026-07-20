import { dashKeyframeCSS, dashKeyframeName } from "@/core/dashPattern";

const registered = new Set<string>();
let styleEl: HTMLStyleElement | null = null;

/**
 * Ensures a `@keyframes` rule exists in the document for this repeat length
 * (memoized so the same length across many nodes reuses one rule) and
 * returns its name to use as `animation-name`. See `dashKeyframeName` for why
 * this can't just be one shared parameterized rule.
 */
export function ensureDashKeyframe(repeat: number): string {
  const name = dashKeyframeName(repeat);
  if (!registered.has(name)) {
    registered.add(name);
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.setAttribute("data-dash-keyframes", "true");
      document.head.appendChild(styleEl);
    }
    styleEl.appendChild(document.createTextNode(dashKeyframeCSS(repeat)));
  }
  return name;
}
