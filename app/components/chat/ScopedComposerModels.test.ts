import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  base: {} as Record<string, unknown>,
  scopes: {} as Record<string, unknown>,
  change: vi.fn(),
}));
vi.mock("@agent-native/core/client/agent-chat", () => ({
  useChatModels: () => state.base,
}));
vi.mock("@agent-native/core/client/hooks", () => ({
  useActionQuery: () => state.scopes,
}));
import { useScopedChatModels } from "./ScopedComposerModels";

describe("Core composer model adapter", () => {
  beforeEach(() => {
    state.change.mockReset();
    state.base = {
      selectedEngine: "anthropic",
      selectedModel: "example-current",
      selectedEffort: "auto",
      isLoading: false,
      availableModels: [
        {
          engine: "anthropic",
          label: "Anthropic",
          configured: true,
          models: ["example-current", "example-hidden"],
        },
      ],
      onModelChange: state.change,
    };
    state.scopes = {
      isLoading: false,
      data: {
        providers: [
          {
            provider: "anthropic",
            models: [{ id: "example-new", name: "New" }],
            fetchedAt: "2026-09-01T00:00:00Z",
            scopedModels: ["example-new"],
            stale: false,
          },
        ],
      },
    };
  });
  it("exposes only scoped models and current selection through the real adapter", () => {
    const result = useScopedChatModels({ enabled: true });
    expect(result.availableModels[0].models).toEqual([
      "example-current",
      "example-new",
    ]);
    expect(result.selectedModel).toBe("example-current");
    result.onModelChange("example-hidden", "anthropic");
    expect(state.change).not.toHaveBeenCalled();
    result.onModelChange("example-new", "anthropic");
    expect(state.change).toHaveBeenCalledWith("example-new", "anthropic");
  });
  it("fails closed to the current selection while scope loading fails", () => {
    state.scopes = { isLoading: false, isError: true };
    const result = useScopedChatModels({ enabled: true });
    expect(result.availableModels[0].models).toEqual(["example-current"]);
    result.onModelChange("example-hidden", "anthropic");
    expect(state.change).not.toHaveBeenCalled();
  });
});
