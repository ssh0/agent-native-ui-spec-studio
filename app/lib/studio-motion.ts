import { flushSync } from "react-dom";

let activeTransition: ViewTransition | undefined;
/** Animate only explicit UI boundaries, never keystrokes, streaming or network work. */
export function transitionStudioView(update: () => void) {
  if (
    typeof document === "undefined" ||
    !document.startViewTransition ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    update();
    return;
  }
  activeTransition?.skipTransition();
  const transition = document.startViewTransition(() => flushSync(update));
  activeTransition = transition;
  // ready rejects if another route/transition takes over; the update still runs.
  void transition.ready.catch(() => {});
  void transition.finished
    .finally(() => {
      if (activeTransition === transition) activeTransition = undefined;
    })
    .catch(() => {});
}
