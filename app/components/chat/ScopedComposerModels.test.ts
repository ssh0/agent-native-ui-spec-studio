import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProviderModels } from "../../../shared/provider-models";

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
  it("exposes only scoped models through the real adapter", () => {
    const result = useScopedChatModels({ enabled: true });
    expect(result.availableModels[0].models).toEqual(["example-new"]);
    expect(result.selectedModel).toBe("example-current");
    result.onModelChange("example-hidden", "anthropic");
    result.onModelChange("example-current", "anthropic");
    expect(state.change).not.toHaveBeenCalled();
    result.onModelChange("example-new", "anthropic");
    expect(state.change).toHaveBeenCalledWith("example-new", "anthropic");
  });
  it("exposes no models while scope loading fails", () => {
    state.scopes = { isLoading: false, isError: true };
    const result = useScopedChatModels({ enabled: true });
    expect(result.availableModels[0].models).toEqual([]);
    result.onModelChange("example-hidden", "anthropic");
    expect(state.change).not.toHaveBeenCalled();
  });
  it("keeps permitted custom OpenAI models selectable and hides Builder models", () => {
    const availableModels = state.base.availableModels as {
      engine: string;
      label: string;
      configured: boolean;
      models: string[];
    }[];
    availableModels.push(
      {
        engine: "ai-sdk:openai",
        label: "OpenAI",
        configured: true,
        models: ["listed-openai-model", "unselected-model"],
      },
      {
        engine: "builder",
        label: "Builder",
        configured: true,
        models: ["builder-standard-model"],
      },
    );
    const providers = state.scopes.data?.providers as ProviderModels[];
    providers.push({
      provider: "openai",
      models: [],
      fetchedAt: null,
      stale: true,
      preserveEngineModels: true,
      scopedModels: ["custom-openai-model", "listed-openai-model"],
    });

    const result = useScopedChatModels({ enabled: true });
    const openai = result.availableModels.find(
      (group) => group.engine === "ai-sdk:openai",
    );
    expect(openai?.models).toEqual([
      "listed-openai-model",
      "custom-openai-model",
    ]);
    expect(
      result.availableModels.some((group) => group.engine === "builder"),
    ).toBe(false);
    result.onModelChange("unselected-model", "ai-sdk:openai");
    result.onModelChange("custom-openai-model", "ai-sdk:openai");
    result.onModelChange("listed-openai-model", "ai-sdk:openai");
    expect(state.change).toHaveBeenCalledTimes(2);
    expect(state.change).toHaveBeenCalledWith(
      "custom-openai-model",
      "ai-sdk:openai",
    );
    expect(state.change).toHaveBeenCalledWith(
      "listed-openai-model",
      "ai-sdk:openai",
    );
  });
});
