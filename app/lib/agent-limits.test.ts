import type { AgentLoopSettingsStatus } from "@agent-native/core/client/agent-loop-settings";
import { describe, expect, it, vi } from "vitest";

import { updateAgentLimit, validAgentLimit } from "./agent-limits";

const status: AgentLoopSettingsStatus = {
  maxIterations: 20,
  defaultMaxIterations: 20,
  minMaxIterations: 1,
  maxMaxIterations: 100,
  scope: "user",
  source: "default",
  canUpdate: true,
  orgId: null,
};
function dependencies(after: Partial<AgentLoopSettingsStatus> = {}) {
  return {
    read: vi
      .fn()
      .mockResolvedValueOnce(status)
      .mockResolvedValue({ ...status, ...after }),
    save: vi.fn().mockResolvedValue({ ...status, ...after }),
    reset: vi.fn().mockResolvedValue(undefined),
  };
}
describe("Builder-independent agent limits", () => {
  it.each(["", " ", "0", "101", "2.5", "NaN", "Infinity"])(
    "rejects invalid input %s",
    (value) => {
      expect(validAgentLimit(value, status)).toBe(false);
    },
  );
  it.each(["1", "20", "100"])("accepts valid input %s", (value) => {
    expect(validAgentLimit(value, status)).toBe(true);
  });
  it("does not trust a save response without re-reading persistence", async () => {
    const deps = dependencies({ maxIterations: 30 });
    expect((await updateAgentLimit(30, deps)).maxIterations).toBe(30);
    expect(deps.read).toHaveBeenCalledTimes(2);
    expect(deps.save).toHaveBeenCalledWith(30);
    const stale = dependencies();
    await expect(updateAgentLimit(30, stale)).rejects.toThrow("verified");
  });
  it("preserves readonly permissions and does not send a write", async () => {
    const deps = dependencies();
    deps.read.mockReset().mockResolvedValue({ ...status, canUpdate: false });
    await expect(updateAgentLimit(30, deps)).rejects.toThrow("read-only");
    expect(deps.save).not.toHaveBeenCalled();
    expect(deps.reset).not.toHaveBeenCalled();
  });
  it("revalidates the current bounds before writing", async () => {
    const deps = dependencies();
    await expect(updateAgentLimit(101, deps)).rejects.toThrow("allowed range");
    expect(deps.save).not.toHaveBeenCalled();
  });
  it("propagates write/read failure without claiming success", async () => {
    const deps = dependencies({ maxIterations: 30 });
    deps.save.mockRejectedValue(new Error("save failed"));
    await expect(updateAgentLimit(30, deps)).rejects.toThrow("save failed");
    expect(deps.read).toHaveBeenCalledTimes(1);
    const readFailure = dependencies({ maxIterations: 30 });
    readFailure.read
      .mockReset()
      .mockResolvedValueOnce(status)
      .mockRejectedValue(new Error("read failed"));
    await expect(updateAgentLimit(30, readFailure)).rejects.toThrow(
      "read failed",
    );
  });
  it("resets using the existing contract and verifies the override was removed", async () => {
    const deps = dependencies({ source: "env", maxIterations: 40 });
    expect((await updateAgentLimit("reset", deps)).source).toBe("env");
    expect(deps.reset).toHaveBeenCalledOnce();
    expect(deps.save).not.toHaveBeenCalled();
    const stale = dependencies({ source: "org" });
    await expect(updateAgentLimit("reset", stale)).rejects.toThrow("verified");
  });
});
