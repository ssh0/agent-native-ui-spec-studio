import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAgentEngineEntry: vi.fn(() => undefined),
  agentChatPlugin: vi.fn(),
  createAgentChatPlugin: vi.fn(),
}));

vi.mock("@agent-native/core/agent/engine", () => ({
  getAgentEngineEntry: mocks.getAgentEngineEntry,
}));
vi.mock("@agent-native/core/org", () => ({ getOrgContext: vi.fn() }));
vi.mock("@agent-native/core/server", () => ({
  createAgentChatPlugin: (options: unknown) => {
    mocks.createAgentChatPlugin(options);
    return mocks.agentChatPlugin;
  },
  loadActionsFromStaticRegistry: () => [],
}));
vi.mock("../../.generated/actions-registry.js", () => ({ default: {} }));

import initializeAgentChatPlugin from "../plugins/agent-chat.js";

describe("agent chat plugin initialization", () => {
  it("keeps domain tools in the initial agent surface without the demo greeting", () => {
    const { initialToolNames } = mocks.createAgentChatPlugin.mock.calls[0][0];
    expect(initialToolNames).not.toContain("hello");
    expect(initialToolNames).toEqual(
      expect.arrayContaining([
        "view-screen",
        "navigate",
        "project-list",
        "spec-load",
        "spec-bootstrap",
        "spec-proposal-create",
      ]),
    );
  });
  it("does not fail when the Google engine is not registered", () => {
    expect(() => initializeAgentChatPlugin({} as never)).not.toThrow();
    expect(mocks.agentChatPlugin).toHaveBeenCalledOnce();
  });
});
