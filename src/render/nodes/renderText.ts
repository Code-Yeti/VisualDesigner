import type { FontStyle, TextNode } from "@/core/model";
import { svgEl, setAttrs, SVG_NS } from "../svgUtil";

/** Builds a <text> with the origin at its top-left (baseline offset by font.size internally). */
export function buildTextElement(content: string, font: FontStyle, fill: string): SVGTextElement {
  const lines = content.length ? content.split("\n") : [""];
  const lineHeight = font.size * 1.25;
  const textEl = svgEl("text", {
    x: 0,
    y: font.size,
    "font-family": font.family,
    "font-size": font.size,
    "font-weight": font.weight,
    "font-style": font.italic ? "italic" : "normal",
    "letter-spacing": font.letterSpacing,
    "text-anchor": font.align,
    fill,
  });
  lines.forEach((line, i) => {
    const tspan = document.createElementNS(SVG_NS, "tspan");
    tspan.setAttribute("x", "0");
    if (i > 0) tspan.setAttribute("dy", String(lineHeight));
    tspan.textContent = line.length ? line : " ";
    textEl.appendChild(tspan);
  });
  return textEl;
}

export function renderTextNode(g: SVGGElement, node: TextNode): void {
  const t = node.transform;
  setAttrs(g, { transform: `translate(${t.x} ${t.y}) rotate(${t.rotation})` });
  g.replaceChildren();
  const textEl = buildTextElement(node.content, node.font, node.fill);
  setAttrs(textEl, { opacity: node.visible === false ? 0 : 1, "pointer-events": "all" });
  g.appendChild(textEl);
}
