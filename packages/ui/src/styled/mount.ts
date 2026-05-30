/**
 * The render loop shared by all three styled screens: subscribe to a headless
 * flow, rebuild the card on every state change, and move focus to the state's
 * focus target (`[data-pk-focus]`) — but only when the status actually changes,
 * so roving focus inside the recover listbox isn't disturbed by re-renders.
 */
import type { ReadableStore } from '../headless';

export interface ScreenHandle {
  unmount(): void;
}

export function mountScreen<S extends { status: string }>(
  root: HTMLElement,
  flow: ReadableStore<S>,
  view: (state: S) => HTMLElement,
): ScreenHandle {
  let prevStatus: string | null = null;
  const render = (): void => {
    const state = flow.getState();
    const cardEl = view(state);
    root.replaceChildren(cardEl);
    if (state.status !== prevStatus) {
      const target = cardEl.querySelector<HTMLElement>('[data-pk-focus]');
      target?.focus({ preventScroll: true });
    }
    prevStatus = state.status;
  };
  const off = flow.subscribe(render);
  render();
  return {
    unmount: () => {
      off();
      root.replaceChildren();
    },
  };
}
