import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProviderModels } from "../../../shared/provider-models";
import { addCustomModelId } from "../settings/ProviderModelScope";

const state = vi.hoisted(() => ({
  base: {} as Record<string, unknown>,
  scopes: {} as Record<string, unknown>,
  change: vi.fn(),
  settings: new Map<string, Record<string, unknown>>(),
  refs: [] as { current: unknown }[],
  refIndex: 0,
  effects: [] as Array<() => void>,
}));
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return {
    ...react,
    useRef: (initial: unknown) => {
      const index = state.refIndex++;
      state.refs[index] ??= { current: initial };
      return state.refs[index];
    },
    useEffect: (effect: () => void) => {
      state.effects.push(effect);
    },
    useMemo: (factory: () => unknown) => factory(),
  };
});
vi.mock("@agent-native/core/client/agent-chat", () => ({
  chatModelSelectionStorageKey: (namespace?: string) =>
    namespace
      ? `agent-native:chat-models:selection:${namespace}`
      : "agent-native:chat-models:selection",
  useChatModels: () => state.base,
}));
vi.mock("@agent-native/core/client/hooks", () => ({
  useActionQuery: () => state.scopes,
}));
vi.mock("@agent-native/core/settings", () => ({
  getUserSetting: async (_email: string, key: string) =>
    state.settings.get(key) ?? null,
  putUserSetting: async (
    _email: string,
    key: string,
    value: Record<string, unknown>,
  ) => state.settings.set(key, value),
}));
vi.mock("@agent-native/core/server", () => ({
  resolveSecret: async (key: string) =>
    key === "OPENAI_BASE_URL" ? "https://gateway.example.invalid/v1" : null,
}));
vi.mock("@agent-native/core/server/request-context", () => ({
  getRequestOrgId: () => null,
}));
vi.mock("@agent-native/core/org", () => ({
  resolveOrgIdForEmail: async () => null,
}));
vi.mock("@agent-native/core/agent/engine", () => ({
  getAgentEngineEntry: () => ({ label: "OpenAI" }),
  isStoredEngineUsableForRequest: async () => true,
}));
vi.mock("../../../server/lib/spec-project.js", () => ({
  currentUserEmail: () => "person@example.invalid",
}));
import { useScopedChatModels } from "./ScopedComposerModels";
import {
  listModelScopes,
  saveModelScope,
} from "../../../server/lib/provider-model-settings";

const storage = new Map<string, string>();
const storageAdapter = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
};

function renderScopedChatModels() {
  let result: ReturnType<typeof useScopedChatModels> | undefined;
  for (let pass = 0; pass < 3; pass++) {
    state.refIndex = 0;
    state.effects = [];
    result = useScopedChatModels({
      enabled: true,
      storageKey: "test-chat-model-selection",
    });
    const effects = state.effects.splice(0);
    if (!effects.length) break;
    for (const effect of effects) effect();
  }
  return result!;
}

describe("Core composer model adapter", () => {
  beforeEach(() => {
    storage.clear();
    state.settings.clear();
    state.refs = [];
    state.refIndex = 0;
    state.effects = [];
    vi.stubGlobal("window", { localStorage: storageAdapter } as unknown as Window);
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
  afterEach(() => vi.unstubAllGlobals());
  it("exposes only scoped models through the real adapter", () => {
    const result = renderScopedChatModels();
    expect(result.availableModels[0].models).toEqual(["example-new"]);
    expect(result.selectedModel).toBe("example-current");
    result.onModelChange("example-hidden", "anthropic");
    result.onModelChange("example-current", "anthropic");
    expect(state.change).not.toHaveBeenCalled();
    result.onModelChange("example-new", "anthropic");
    expect(state.change).toHaveBeenCalledWith("example-new", "anthropic");
  });
  it("exposes newest date-less versions first in the chat model groups", () => {
    state.base = {
      ...state.base,
      availableModels: [
        {
          engine: "ai-sdk:google",
          label: "Google",
          configured: true,
          models: [
            "gemini-2.5-flash",
            "gemini-3.8-flash",
            "gemini-3.10-flash",
          ],
        },
      ],
    };
    state.scopes = {
      data: {
        providers: [
          {
            provider: "google",
            models: [
              { id: "gemini-2.5-flash", name: "Gemini 2.5" },
              { id: "gemini-3.8-flash", name: "Gemini 3.8" },
              { id: "gemini-3.10-flash", name: "Gemini 3.10" },
            ],
            fetchedAt: "2026-09-01T00:00:00Z",
            scopedModels: null,
            stale: false,
          },
        ],
      },
    };
    expect(renderScopedChatModels().availableModels[0].models).toEqual([
      "gemini-3.10-flash",
      "gemini-3.8-flash",
      "gemini-2.5-flash",
    ]);
  });
  it("exposes no models while scope loading fails", () => {
    state.scopes = { isLoading: false, isError: true };
    const result = renderScopedChatModels();
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

    const result = renderScopedChatModels();
    const openai = result.availableModels.find(
      (group) => group.engine === "ai-sdk:openai",
    );
    expect(openai?.models).toEqual([
      "custom-openai-model",
      "listed-openai-model",
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
  it("adds, saves, selects, and restores a gateway model after Core reload reconciliation", async () => {
    const addition = addCustomModelId("gateway-only-model", [], []);
    expect(addition).toEqual({
      id: "gateway-only-model",
      scope: ["gateway-only-model"],
    });
    await saveModelScope("openai", addition!.scope);
    const savedScopes = await listModelScopes();
    expect(
      savedScopes.providers.find((provider) => provider.provider === "openai")
        ?.scopedModels,
    ).toEqual(["gateway-only-model"]);
    const selectionKey = "test-chat-model-selection";
    const savedSelection = {
      model: "gateway-only-model",
      engine: "ai-sdk:openai",
      effort: "auto",
    };
    const persistSelection = (model: string, engine: string) => {
      state.change(model, engine);
      state.base.selectedModel = model;
      state.base.selectedEngine = engine;
      storage.set(
        selectionKey,
        JSON.stringify({ ...savedSelection, model, engine }),
      );
    };
    state.scopes = {
      isLoading: false,
      data: savedScopes,
    };
    state.base = {
      selectedEngine: "builder",
      selectedModel: "builder-default",
      selectedEffort: "auto",
      isLoading: false,
      availableModels: [
        {
          engine: "builder",
          label: "Builder",
          configured: true,
          models: ["builder-default"],
        },
      ],
      onModelChange: persistSelection,
    };

    const firstLoad = renderScopedChatModels();
    expect(firstLoad.availableModels).toContainEqual(
      expect.objectContaining({
        engine: "ai-sdk:openai",
        models: ["gateway-only-model"],
      }),
    );
    firstLoad.onModelChange("gateway-only-model", "ai-sdk:openai");
    expect(state.change).toHaveBeenCalledWith(
      "gateway-only-model",
      "ai-sdk:openai",
    );

    state.base.selectedModel = "builder-default";
    state.base.selectedEngine = "builder";
    storage.set(
      selectionKey,
      JSON.stringify({ model: "builder-default", engine: "builder" }),
    );
    const reconciled = renderScopedChatModels();
    expect(reconciled.selectedModel).toBe("gateway-only-model");
    expect(reconciled.selectedEngine).toBe("ai-sdk:openai");
    expect(JSON.parse(storage.get(selectionKey)!)).toMatchObject(savedSelection);

    state.refs = [];
    state.base.selectedModel = "gateway-only-model";
    state.base.selectedEngine = "ai-sdk:openai";
    const reloaded = renderScopedChatModels();
    state.base.selectedModel = "builder-default";
    state.base.selectedEngine = "builder";
    storage.set(
      selectionKey,
      JSON.stringify({ model: "builder-default", engine: "builder" }),
    );
    const reloadedAfterCoreReconciliation = renderScopedChatModels();
    expect(reloaded.availableModels).toContainEqual(
      expect.objectContaining({
        engine: "ai-sdk:openai",
        models: ["gateway-only-model"],
      }),
    );
    expect(reloadedAfterCoreReconciliation.selectedModel).toBe(
      "gateway-only-model",
    );
    expect(reloadedAfterCoreReconciliation.selectedEngine).toBe(
      "ai-sdk:openai",
    );
    expect(JSON.parse(storage.get(selectionKey)!)).toMatchObject(savedSelection);
  });
});
