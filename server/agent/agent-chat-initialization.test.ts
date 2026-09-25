import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAgentEngineEntry: vi.fn(() => undefined),
  agentChatPlugin: vi.fn(),
}));

vi.mock("@agent-native/core/agent/engine", () => ({
  getAgentEngineEntry: mocks.getAgentEngineEntry,
}));
vi.mock("@agent-native/core/org", () => ({ getOrgContext: vi.fn() }));
vi.mock("@agent-native/core/server", () => ({
  createAgentChatPlugin: () => mocks.agentChatPlugin,
  loadActionsFromStaticRegistry: () => [],
}));
vi.mock("../../.generated/actions-registry.js", () => ({ default: {} }));

import initializeAgentChatPlugin from "../plugins/agent-chat.js";

describe("agent chat plugin initialization", () => {
  it("does not fail when the Google engine is not registered", () => {
    expect(() => initializeAgentChatPlugin({} as never)).not.toThrow();
    expect(mocks.agentChatPlugin).toHaveBeenCalledOnce();
  });
});
