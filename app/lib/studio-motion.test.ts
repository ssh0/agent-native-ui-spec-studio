import { afterEach, describe, expect, it, vi } from "vitest";

import { transitionStudioView } from "./studio-motion";

afterEach(() => vi.unstubAllGlobals());
describe("explicit UI view transitions", () => {
  it("updates immediately without browser support", () => {
    vi.stubGlobal("document", {});
    const update = vi.fn();
    transitionStudioView(update);
    expect(update).toHaveBeenCalledOnce();
  });
  it("respects reduced motion without starting a snapshot", () => {
    const start = vi.fn();
    vi.stubGlobal("document", { startViewTransition: start });
    vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
    const update = vi.fn();
    transitionStudioView(update);
    expect(update).toHaveBeenCalledOnce();
    expect(start).not.toHaveBeenCalled();
  });
  it("commits one synchronous update and skips superseded animations", async () => {
    const skip = vi.fn();
    const start = vi.fn((update: () => void) => {
      update();
      return {
        ready: Promise.reject(new Error("superseded")),
        finished: Promise.resolve(),
        skipTransition: skip,
      };
    });
    vi.stubGlobal("document", { startViewTransition: start });
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
    const update = vi.fn();
    transitionStudioView(update);
    transitionStudioView(update);
    expect(update).toHaveBeenCalledTimes(2);
    expect(start).toHaveBeenCalledTimes(2);
    expect(skip).toHaveBeenCalledOnce();
    await Promise.resolve();
  });
});
