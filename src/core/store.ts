export type Listener<T> = (state: T) => void;

/**
 * Minimal observable store. `patch` replaces the whole state object
 * (callers produce a new object via immutable update helpers) and notifies
 * subscribers synchronously.
 */
export class Store<T> {
  private state: T;
  private listeners = new Set<Listener<T>>();

  constructor(initial: T) {
    this.state = initial;
  }

  get(): T {
    return this.state;
  }

  patch(next: T): void {
    this.state = next;
    for (const listener of this.listeners) listener(this.state);
  }

  update(fn: (state: T) => T): void {
    this.patch(fn(this.state));
  }

  subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
