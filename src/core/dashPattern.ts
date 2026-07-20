import type { DashKind } from "./model";

/** Dotted stays a fixed short pattern; dashed derives its gap from the user's length so the segment:gap ratio stays consistent as length changes. */
export function computeDashArray(dash: DashKind, length: number): string | undefined {
  if (dash === "solid") return undefined;
  if (dash === "dotted") return "2 5";
  return `${length} ${Math.max(1, length * 0.6)}`;
}
