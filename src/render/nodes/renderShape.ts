import type { PolygonGeom, RectGeom, EllipseGeom, CloudGeom, ShapeNode } from "@/core/model";
import { CLOUD_BASE, ICON_PRESETS } from "@/core/presets";
import { getBoundTextLayout } from "@/core/textLayout";
import { computeDashArray, computeDashRepeatLength } from "@/core/dashPattern";
import { ensureDashKeyframe } from "../dashKeyframes";
import { svgEl, setAttrs } from "../svgUtil";
import { buildTextElement } from "./renderText";

interface Entry {
  body: SVGGElement;
  textGroup: SVGGElement;
  signature: string;
}

const cache = new Map<string, Entry>();

function fillValue(node: ShapeNode): string {
  const { fill } = node.style;
  if (fill.kind === "solid") return fill.color;
  if (fill.kind === "gradient") return `url(#${fill.gradientId})`;
  return "none";
}

export function renderShapeNode(g: SVGGElement, node: ShapeNode): void {
  const t = node.transform;
  const hidden = node.visible === false;
  setAttrs(g, {
    transform: `translate(${t.x} ${t.y}) rotate(${t.rotation})`,
    "pointer-events": hidden ? "none" : undefined,
  });

  const iconKey = node.type === "icon" ? node.iconKey : undefined;
  const signature = `${node.type}:${node.geometry.kind}:${iconKey ?? ""}`;

  let entry = cache.get(node.id);
  if (!entry || entry.signature !== signature) {
    entry?.body.remove();
    entry?.textGroup.remove();
    const body = svgEl("g", { class: "shape-body" });
    const textGroup = svgEl("g", { class: "bound-text" });
    g.insertBefore(body, g.firstChild);
    g.appendChild(textGroup);
    entry = { body, textGroup, signature };
    cache.set(node.id, entry);
  }

  const style = node.style;
  setAttrs(entry.body, {
    opacity: node.visible === false ? 0 : style.opacity,
    filter: style.filterId ? `url(#${style.filterId})` : undefined,
  });
  entry.body.replaceChildren();

  const fill = fillValue(node);
  const dashRepeat = style.strokeAnimated ? computeDashRepeatLength(style.strokeDash, style.strokeDashLength) : undefined;
  const common = {
    fill,
    stroke: style.stroke,
    "stroke-width": style.strokeWidth,
    "stroke-dasharray": computeDashArray(style.strokeDash, style.strokeDashLength),
    "stroke-linecap": style.strokeDash !== "solid" && style.strokeDashRounded ? "round" : undefined,
    class: style.strokeAnimated ? "dash-ants" : undefined,
    style: dashRepeat !== undefined ? `animation-name:${ensureDashKeyframe(dashRepeat)};animation-duration:${style.strokeAnimationSeconds}s` : undefined,
    "data-dash-repeat": dashRepeat,
  };
  const pe = hidden ? "none" : "all";

  if (node.type === "rect" || node.type === "pill") {
    const geom = node.geometry as RectGeom;
    const rx = node.type === "pill" ? geom.height / 2 : geom.rx;
    const ry = node.type === "pill" ? geom.height / 2 : geom.ry;
    entry.body.appendChild(svgEl("rect", { x: 0, y: 0, width: geom.width, height: geom.height, rx, ry, "pointer-events": pe, ...common }));
  } else if (node.type === "ellipse") {
    const geom = node.geometry as EllipseGeom;
    entry.body.appendChild(svgEl("ellipse", { cx: geom.rx, cy: geom.ry, rx: geom.rx, ry: geom.ry, "pointer-events": pe, ...common }));
  } else if (node.type === "polygon") {
    const geom = node.geometry as PolygonGeom;
    const points = geom.points.map((p) => `${p.x},${p.y}`).join(" ");
    entry.body.appendChild(svgEl("polygon", { points, "pointer-events": pe, ...common }));
  } else if (node.type === "cloud") {
    const geom = node.geometry as CloudGeom;
    const sx = geom.width / CLOUD_BASE.width;
    const sy = geom.height / CLOUD_BASE.height;
    const hitArea = svgEl("rect", {
      x: 0,
      y: 0,
      width: geom.width,
      height: geom.height,
      fill: "transparent",
      stroke: "none",
      "pointer-events": pe,
    });
    const inner = svgEl("g", { transform: `scale(${sx} ${sy})` });
    inner.appendChild(
      svgEl("ellipse", {
        cx: CLOUD_BASE.ellipse.cx,
        cy: CLOUD_BASE.ellipse.cy,
        rx: CLOUD_BASE.ellipse.rx,
        ry: CLOUD_BASE.ellipse.ry,
        ...common,
      })
    );
    for (const c of CLOUD_BASE.circles) {
      inner.appendChild(svgEl("circle", { cx: c.cx, cy: c.cy, r: c.r, ...common }));
    }
    entry.body.append(hitArea, inner);
  } else if (node.type === "image") {
    const geom = node.geometry as RectGeom;
    entry.body.appendChild(
      svgEl("image", {
        x: 0,
        y: 0,
        width: geom.width,
        height: geom.height,
        href: node.imageSrc ?? "",
        preserveAspectRatio: "xMidYMid meet",
        "pointer-events": pe,
      })
    );
  } else if (node.type === "icon") {
    const geom = node.geometry as RectGeom;
    const preset = ICON_PRESETS.find((p) => p.key === iconKey) ?? ICON_PRESETS[0];
    const scale = (Math.min(geom.width, geom.height) * 0.6) / 24;
    const tx = (geom.width - 24 * scale) / 2;
    const ty = (geom.height - 24 * scale) / 2;
    const hitArea = svgEl("rect", {
      x: 0,
      y: 0,
      width: geom.width,
      height: geom.height,
      fill: "transparent",
      stroke: "none",
      "pointer-events": pe,
    });
    const inner = svgEl("g", { transform: `translate(${tx} ${ty}) scale(${scale})`, class: "icon-glyph" });
    for (const d of preset.paths ?? []) {
      inner.appendChild(
        svgEl("path", { d, fill: "none", stroke: style.stroke, "stroke-width": 1.7, "stroke-linecap": "round", "stroke-linejoin": "round" })
      );
    }
    for (const c of preset.circles ?? []) {
      inner.appendChild(
        svgEl("circle", {
          cx: c.cx,
          cy: c.cy,
          r: c.r,
          fill: c.filled ? style.stroke : "none",
          stroke: c.filled ? "none" : style.stroke,
          "stroke-width": c.filled ? undefined : 1.7,
        })
      );
    }
    entry.body.append(hitArea, inner);
  }

  renderBoundText(entry.textGroup, node);
}

function renderBoundText(textGroup: SVGGElement, node: ShapeNode): void {
  textGroup.replaceChildren();
  if (!node.boundText) return;
  const layout = getBoundTextLayout(node);

  if (node.boundText.title && layout.title) {
    const wrap = svgEl("g", { transform: `translate(${layout.title.x} ${layout.title.y})`, "data-bound": "title" });
    wrap.appendChild(buildTextElement(node.boundText.title.content, node.boundText.title.font, node.boundText.title.fill));
    setAttrs(wrap, { "pointer-events": "all" });
    textGroup.appendChild(wrap);
  }
  if (node.boundText.subtitle && layout.subtitle) {
    const wrap = svgEl("g", { transform: `translate(${layout.subtitle.x} ${layout.subtitle.y})`, "data-bound": "subtitle" });
    wrap.appendChild(buildTextElement(node.boundText.subtitle.content, node.boundText.subtitle.font, node.boundText.subtitle.fill));
    setAttrs(wrap, { "pointer-events": "all" });
    textGroup.appendChild(wrap);
  }
}

export function disposeShapeCache(id: string): void {
  cache.delete(id);
}
