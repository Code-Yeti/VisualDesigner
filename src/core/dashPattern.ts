import type { DashKind } from "./model";

/** Dotted stays a fixed short pattern; dashed derives its gap from the user's length so the segment:gap ratio stays consistent as length changes. */
export function computeDashArray(dash: DashKind, length: number): string | undefined {
  if (dash === "solid") return undefined;
  if (dash === "dotted") return "2 5";
  return `${length} ${Math.max(1, length * 0.6)}`;
}

/**
 * Full repeat length (dash + gap) of the pattern above, in the same px
 * units - the exact distance a marching-ants animation must shift per cycle
 * for the loop to tile seamlessly. A mismatch here doesn't change the dash
 * *pattern*, only where the animation "seams": each cycle ends with a jump
 * back to offset 0, and that jump is invisible only when it's exactly one
 * full pattern repeat. Get it wrong and the dashes visibly hitch once per
 * cycle - barely noticeable on a straight run where there's no fixed
 * reference point, but jarring at a path corner or a rounded rect corner
 * where the eye can see the dash position jump relative to a fixed vertex.
 */
export function computeDashRepeatLength(dash: DashKind, length: number): number {
  if (dash === "dotted") return 2 + 5;
  return length + Math.max(1, length * 0.6);
}
