import { Store } from "./store";
import type { Project } from "./model";

const CAPACITY = 100;

/**
 * A Store<Project> that also tracks undo/redo history. Every `patch()` call
 * (and therefore every `update()` call, since the base Store implements
 * update in terms of patch) pushes the prior state as one undo step -
 * except while a "gesture" is open (beginGesture/endGesture), during which
 * patches apply live with no history entry, and the whole gesture collapses
 * into a single undo step when it ends. That's what keeps a multi-pixel
 * drag as one undo step instead of one per pointermove.
 *
 * Subclassing rather than wrapping means every existing call site that
 * already has a `Store<Project>` reference gets history tracking for free,
 * with zero changes required outside the handful of drag-tools that need to
 * bracket their gestures.
 */
export class HistoryStore extends Store<Project> {
  private undoStack: Project[] = [];
  private redoStack: Project[] = [];
  private gestureSnapshot: Project | null = null;
  private inGesture = false;

  override patch(next: Project): void {
    const current = this.get();
    if (next === current) return;
    if (!this.inGesture) {
      this.undoStack.push(current);
      if (this.undoStack.length > CAPACITY) this.undoStack.shift();
      this.redoStack = [];
    }
    super.patch(next);
  }

  beginGesture(): void {
    this.gestureSnapshot = this.get();
    this.inGesture = true;
  }

  endGesture(): void {
    this.inGesture = false;
    const snapshot = this.gestureSnapshot;
    this.gestureSnapshot = null;
    if (snapshot && snapshot !== this.get()) {
      this.undoStack.push(snapshot);
      if (this.undoStack.length > CAPACITY) this.undoStack.shift();
      this.redoStack = [];
    }
  }

  undo(): void {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push(this.get());
    super.patch(prev);
  }

  redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(this.get());
    super.patch(next);
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }
}
