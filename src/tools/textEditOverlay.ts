/**
 * A single floating HTML <textarea> used to edit text content in place
 * (standalone text nodes and bound title/subtitle). SVG <text> has no native
 * contentEditable, so editing happens through this overlay rather than
 * through a foreignObject embedded in the exportable content.
 */
export interface TextEditOverlay {
  open(screenX: number, screenY: number, initial: string, onCommit: (value: string) => void): void;
}

export function createTextEditOverlay(container: HTMLElement): TextEditOverlay {
  const textarea = document.createElement("textarea");
  textarea.className = "text-edit-overlay";
  textarea.style.display = "none";
  container.appendChild(textarea);

  let commitFn: ((value: string) => void) | null = null;
  let closing = false;

  function close(commit: boolean) {
    if (closing) return;
    closing = true;
    if (commit && commitFn) commitFn(textarea.value);
    textarea.style.display = "none";
    commitFn = null;
    closing = false;
  }

  textarea.addEventListener("blur", () => close(true));
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close(false);
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      close(true);
    }
    e.stopPropagation();
  });
  textarea.addEventListener("pointerdown", (e) => e.stopPropagation());

  function open(screenX: number, screenY: number, initial: string, onCommit: (value: string) => void) {
    commitFn = onCommit;
    textarea.value = initial;
    textarea.style.display = "block";
    textarea.style.left = `${screenX}px`;
    textarea.style.top = `${screenY}px`;
    textarea.focus();
    textarea.select();
  }

  return { open };
}
