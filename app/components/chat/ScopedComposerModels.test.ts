import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { UseChatModelsResult } from "@agent-native/core/client/agent-chat";
import type {
  ModelScopeList,
  ProviderModels,
} from "../../../shared/provider-models";
import { addCustomModelId } from "../settings/ProviderModelScope";

type MockChatModels = Pick<
  UseChatModelsResult,
  | "availableModels"
  | "selectedEngine"
  | "selectedModel"
  | "selectedEffort"
  | "isLoading"
  | "onModelChange"
> & {
  onEffortChange?: UseChatModelsResult["onEffortChange"];
};

const state = vi.hoisted(() => ({
  base: {} as MockChatModels,
  scopes: {} as {
    isLoading?: boolean;
    isError?: boolean;
    data?: ModelScopeList;
  },
  change: vi.fn(),
  settings: new Map<string, Record<string, unknown>>(),
  refs: [] as { current: unknown }[],
  refIndex: 0,
  effects: [] as Array<() => void>,
  windowListeners: new Map<string, Set<EventListener>>(),
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
const testWindow = {
  localStorage: storageAdapter,
  addEventListener: (type: string, listener: EventListener) => {
    const listeners =
      state.windowListeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    state.windowListeners.set(type, listeners);
  },
  removeEventListener: (type: string, listener: EventListener) => {
    state.windowListeners.get(type)?.delete(listener);
  },
  dispatchEvent: (event: Event) => {
    state.windowListeners
      .get(event.type)
      ?.forEach((listener) => listener(event));
    return true;
  },
};

function dispatchSelectionChange(key: string) {
  const event = new Event("agent-native:chat-model-selection-changed");
  Object.defineProperty(event, "detail", { value: { key } });
  window.dispatchEvent(event);
}

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
    state.windowListeners.clear();
    vi.stubGlobal("window", testWindow as unknown as Window);
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
            "gemini-3-flash-preview",
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
              { id: "gemini-3-flash-preview", name: "Gemini 3 preview" },
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
      "gemini-3-flash-preview",
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
    const availableModels = state.base.availableModels;
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
  it("restores a persisted custom model and effort after Core fallback", async () => {
    const addition = addCustomModelId("gpt-5", [], []);
    expect(addition).toEqual({
      id: "gpt-5",
      scope: ["gpt-5"],
    });
    await saveModelScope("openai", addition!.scope);
    const savedScopes = await listModelScopes();
    expect(
      savedScopes.providers.find((provider) => provider.provider === "openai")
        ?.scopedModels,
    ).toEqual(["gpt-5"]);
    const selectionKey = "test-chat-model-selection";
    const savedSelection = {
      model: "gpt-5",
      engine: "ai-sdk:openai",
      effort: "xhigh",
    };
    storage.set(selectionKey, JSON.stringify(savedSelection));
    const persistSelection = (model: string, engine: string) => {
      state.change(model, engine);
      state.base.selectedModel = model;
      state.base.selectedEngine = engine;
      storage.set(
        selectionKey,
        JSON.stringify({
          model,
          engine,
          effort: state.base.selectedEffort,
        }),
      );
    };
    const persistEffort = (effort: UseChatModelsResult["selectedEffort"]) => {
      state.base.selectedEffort = effort;
      storage.set(selectionKey, JSON.stringify({ ...savedSelection, effort }));
    };
    state.scopes = {
      isLoading: false,
      data: {
        ...savedScopes,
        providers: savedScopes.providers.map((provider) =>
          provider.provider === "anthropic"
            ? {
                ...provider,
                configured: true,
                models: [{ id: "example-new", name: "New" }],
                fetchedAt: "2026-09-01T00:00:00Z",
                scopedModels: null,
              }
            : provider,
        ),
      },
    };
    state.base = {
      selectedEngine: "anthropic",
      selectedModel: "example-new",
      selectedEffort: "xhigh",
      isLoading: false,
      availableModels: [
        {
          engine: "builder",
          label: "Builder",
          configured: true,
          models: ["builder-default"],
        },
        {
          engine: "anthropic",
          label: "Anthropic",
          configured: true,
          models: ["example-new"],
        },
      ],
      onModelChange: persistSelection,
      onEffortChange: persistEffort,
    };

    const firstLoad = renderScopedChatModels();
    expect(firstLoad.availableModels).toContainEqual(
      expect.objectContaining({
        engine: "ai-sdk:openai",
        models: ["gpt-5"],
      }),
    );
    expect(firstLoad.selectedModel).toBe("example-new");
    firstLoad.onModelChange("gpt-5", "ai-sdk:openai");
    expect(state.change).toHaveBeenCalledWith("gpt-5", "ai-sdk:openai");
    expect(JSON.parse(storage.get(selectionKey)!)).toMatchObject(savedSelection);

    state.refs = [];
    state.windowListeners.clear();
    state.base.selectedModel = "gpt-5";
    state.base.selectedEngine = "ai-sdk:openai";
    state.base.isLoading = true;
    const reload = renderScopedChatModels();
    expect(reload.selectedModel).toBe("gpt-5");
    expect(reload.selectedEffort).toBe("xhigh");

    storage.set(
      selectionKey,
      JSON.stringify({
        model: "gemini-3-flash-preview",
        engine: "ai-sdk:google",
        effort: "high",
      }),
    );
    dispatchSelectionChange(selectionKey);
    state.base.availableModels.push({
      engine: "ai-sdk:google",
      label: "Google",
      configured: true,
      models: ["gemini-3-flash-preview"],
    });
    state.base.selectedModel = "gemini-3-flash-preview";
    state.base.selectedEngine = "ai-sdk:google";
    state.base.selectedEffort = "high";
    state.base.isLoading = false;
    const reconciled = renderScopedChatModels();
    expect(reconciled.selectedModel).toBe("gpt-5");
    expect(reconciled.selectedEngine).toBe("ai-sdk:openai");
    expect(reconciled.selectedEffort).toBe("xhigh");
    expect(JSON.parse(storage.get(selectionKey)!)).toMatchObject(savedSelection);
    expect(state.change).toHaveBeenCalledTimes(2);
    expect(state.change).toHaveBeenLastCalledWith("gpt-5", "ai-sdk:openai");

    state.base.selectedModel = "example-new";
    state.base.selectedEngine = "anthropic";
    state.base.selectedEffort = "medium";
    storage.set(
      selectionKey,
      JSON.stringify({
        model: "example-new",
        engine: "anthropic",
        effort: "medium",
      }),
    );
    const afterSidebarSelection = renderScopedChatModels();
    expect(afterSidebarSelection.selectedModel).toBe("example-new");
    expect(afterSidebarSelection.selectedEngine).toBe("anthropic");
    expect(afterSidebarSelection.selectedEffort).toBe("medium");
    expect(state.change).toHaveBeenCalledTimes(2);
  });
  it("keeps a newer cross-tab model selection over pending custom recovery", async () => {
    await saveModelScope("openai", ["gpt-5"]);
    const providers = (await listModelScopes()).providers.map((provider) =>
      provider.provider === "anthropic"
        ? {
            ...provider,
            configured: true,
            models: [{ id: "example-new", name: "New" }],
            fetchedAt: "2026-09-01T00:00:00Z",
            scopedModels: null,
          }
        : provider,
    );
    state.scopes = { data: { providers } };
    const selectionKey = "test-chat-model-selection";
    storage.set(
      selectionKey,
      JSON.stringify({
        model: "gpt-5",
        engine: "ai-sdk:openai",
        effort: "xhigh",
      }),
    );
    state.base = {
      selectedEngine: "ai-sdk:openai",
      selectedModel: "gpt-5",
      selectedEffort: "xhigh",
      isLoading: true,
      availableModels: [
        {
          engine: "anthropic",
          label: "Anthropic",
          configured: true,
          models: ["example-new"],
        },
      ],
      onModelChange: state.change,
      onEffortChange: vi.fn(),
    };
    renderScopedChatModels();

    const newerSelection = {
      model: "example-new",
      engine: "anthropic",
      effort: "medium",
    } as const;
    storage.set(selectionKey, JSON.stringify(newerSelection));
    state.base.selectedModel = newerSelection.model;
    state.base.selectedEngine = newerSelection.engine;
    state.base.selectedEffort = newerSelection.effort;
    state.base.isLoading = false;
    const storageEvent = new Event("storage");
    Object.defineProperty(storageEvent, "key", { value: selectionKey });
    window.dispatchEvent(storageEvent);

    const result = renderScopedChatModels();
    expect(result.selectedModel).toBe("example-new");
    expect(result.selectedEngine).toBe("anthropic");
    expect(result.selectedEffort).toBe("medium");
    expect(state.change).not.toHaveBeenCalled();
  });
  it("keeps a newer same-tab sidebar selection during Core refresh", async () => {
    await saveModelScope("openai", ["gpt-5"]);
    const providers = (await listModelScopes()).providers.map((provider) =>
      provider.provider === "anthropic"
        ? {
            ...provider,
            configured: true,
            models: [{ id: "example-new", name: "New" }],
            fetchedAt: "2026-09-01T00:00:00Z",
            scopedModels: null,
          }
        : provider,
    );
    state.scopes = { data: { providers } };
    const selectionKey = "test-chat-model-selection";
    storage.set(
      selectionKey,
      JSON.stringify({
        model: "gpt-5",
        engine: "ai-sdk:openai",
        effort: "xhigh",
      }),
    );
    state.base = {
      selectedEngine: "ai-sdk:openai",
      selectedModel: "gpt-5",
      selectedEffort: "xhigh",
      isLoading: true,
      availableModels: [
        {
          engine: "anthropic",
          label: "Anthropic",
          configured: true,
          models: ["example-new"],
        },
      ],
      onModelChange: state.change,
      onEffortChange: vi.fn(),
    };
    renderScopedChatModels();

    const newerSelection = {
      model: "example-new",
      engine: "anthropic",
      effort: "medium",
    } as const;
    storage.set(selectionKey, JSON.stringify(newerSelection));
    dispatchSelectionChange(selectionKey);
    expect(renderScopedChatModels().selectedModel).toBe("gpt-5");
    state.base.selectedModel = newerSelection.model;
    state.base.selectedEngine = newerSelection.engine;
    state.base.selectedEffort = newerSelection.effort;
    state.base.isLoading = false;

    const result = renderScopedChatModels();
    expect(result.selectedModel).toBe("example-new");
    expect(result.selectedEngine).toBe("anthropic");
    expect(result.selectedEffort).toBe("medium");
    expect(state.change).not.toHaveBeenCalled();
  });
  it("keeps a same-tab effort update while Core still has the old effort", async () => {
    await saveModelScope("openai", ["gpt-5"]);
    const providers = (await listModelScopes()).providers;
    state.scopes = { data: { providers } };
    const selectionKey = "test-chat-model-selection";
    storage.set(
      selectionKey,
      JSON.stringify({
        model: "gpt-5",
        engine: "ai-sdk:openai",
        effort: "high",
      }),
    );
    state.base = {
      selectedEngine: "ai-sdk:openai",
      selectedModel: "gpt-5",
      selectedEffort: "high",
      isLoading: true,
      availableModels: [],
      onModelChange: state.change,
      onEffortChange: vi.fn(),
    };
    renderScopedChatModels();

    const newerSelection = {
      model: "gpt-5",
      engine: "ai-sdk:openai",
      effort: "xhigh",
    };
    storage.set(selectionKey, JSON.stringify(newerSelection));
    dispatchSelectionChange(selectionKey);
    expect(renderScopedChatModels().selectedEffort).toBe("high");
    state.base.selectedEffort = "xhigh";
    state.base.isLoading = false;

    const result = renderScopedChatModels();
    expect(result.selectedEffort).toBe("xhigh");
    expect(JSON.parse(storage.get(selectionKey)!)).toEqual(newerSelection);
  });
});
