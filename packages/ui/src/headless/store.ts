/** A tiny framework-agnostic observable store (the headless flows' base). */
export interface ReadableStore<S> {
  getState(): S;
  subscribe(listener: (state: S) => void): () => void;
}

export interface Store<S> extends ReadableStore<S> {
  set(next: S): void;
}

export function createStore<S>(initial: S): Store<S> {
  let state = initial;
  const listeners = new Set<(state: S) => void>();
  return {
    getState: () => state,
    set: (next: S) => {
      state = next;
      for (const listener of listeners) listener(state);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
