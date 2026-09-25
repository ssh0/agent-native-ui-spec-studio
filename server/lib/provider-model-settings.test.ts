import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  email: "person@example.invalid" as string | null,
  org: "example-org" as string | undefined,
  store: new Map<string, Record<string, unknown>>(),
  secret: "example-credential" as string | null,
  endpoint: null as string | null,
  fetchModels: vi.fn(),
}));
vi.mock("@agent-native/core/settings", () => ({
  getUserSetting: async (email: string, key: string) =>
    state.store.get(`${email}:${key}`) ?? null,
  putUserSetting: async (
    email: string,
    key: string,
    value: Record<string, unknown>,
  ) => {
    state.store.set(`${email}:${key}`, value);
  },
}));
vi.mock("@agent-native/core/server", () => ({
  resolveSecret: async (key: string) =>
    key === "OPENAI_BASE_URL" ? state.endpoint : state.secret,
}));
vi.mock("@agent-native/core/server/request-context", () => ({
  getRequestOrgId: () => state.org,
}));
vi.mock("@agent-native/core/org", () => ({
  resolveOrgIdForEmail: async () => null,
}));
vi.mock("@agent-native/core/agent/engine", () => ({
  getAgentEngineEntry: () => ({ label: "Example provider" }),
  isStoredEngineUsableForRequest: async () => Boolean(state.secret),
}));
vi.mock("./spec-project.js", () => ({
  currentUserEmail: () => {
    if (!state.email) throw new Error("Sign in required");
    return state.email;
  },
}));
vi.mock("./provider-model-catalog.js", () => ({
  catalogKeys: { anthropic: "ANTHROPIC_API_KEY", openai: "OPENAI_API_KEY" },
  fetchProviderModels: state.fetchModels,
}));
import {
  CATALOG_TTL_MS,
  listModelScopes,
  loadProviderModels,
  readProviderModels,
  saveModelScope,
} from "./provider-model-settings";

describe("scoped model persistence and caching", () => {
  beforeEach(() => {
    vi.useRealTimers();
    state.store.clear();
    state.email = "person@example.invalid";
    state.org = "example-org";
    state.secret = "example-credential";
    state.endpoint = null;
    state.fetchModels
      .mockReset()
      .mockResolvedValue([{ id: "example-chat", name: "Example" }]);
  });
  it("fetches once within the TTL, refreshes explicitly, and re-fetches after expiration", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T00:00:00Z"));
    expect((await loadProviderModels("anthropic")).models).toHaveLength(1);
    await loadProviderModels("anthropic");
    expect(state.fetchModels).toHaveBeenCalledTimes(1);
    await loadProviderModels("anthropic", true);
    expect(state.fetchModels).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(CATALOG_TTL_MS + 1);
    await loadProviderModels("anthropic");
    expect(state.fetchModels).toHaveBeenCalledTimes(3);
  });
  it("keeps catalog and selected missing IDs on failure, without echoing provider errors", async () => {
    await loadProviderModels("anthropic");
    await saveModelScope("anthropic", [
      "example-retired",
      "example-chat",
      "example-chat",
    ]);
    state.fetchModels.mockRejectedValue(
      new Error("private diagnostic example"),
    );
    const result = await loadProviderModels("anthropic", true);
    expect(result.stale).toBe(true);
    expect(result.models).toHaveLength(1);
    expect(result.scopedModels).toEqual(["example-retired", "example-chat"]);
    expect(result.error).not.toContain("private diagnostic");
  });
  it("isolates scopes and catalogs by authenticated user and organization", async () => {
    await loadProviderModels("anthropic");
    await saveModelScope("anthropic", ["example-chat"]);
    state.email = "other@example.invalid";
    expect(await readProviderModels("anthropic")).toMatchObject({
      models: [],
      scopedModels: null,
    });
    state.email = "person@example.invalid";
    state.org = "another-example-org";
    expect(await readProviderModels("anthropic")).toMatchObject({
      models: [],
      scopedModels: null,
    });
    state.org = "example-org";
    expect((await readProviderModels("anthropic")).scopedModels).toEqual([
      "example-chat",
    ]);
  });
  it("distinguishes unrestricted and explicit empty scopes after re-reading", async () => {
    expect((await saveModelScope("anthropic", [])).scopedModels).toEqual([]);
    expect((await saveModelScope("anthropic", null)).scopedModels).toBeNull();
  });
  it("rejects unauthenticated requests before reading or writing", async () => {
    state.email = null;
    await expect(listModelScopes()).rejects.toThrow("Sign in");
    await expect(saveModelScope("anthropic", [])).rejects.toThrow("Sign in");
    await expect(loadProviderModels("anthropic")).rejects.toThrow("Sign in");
    expect(state.store.size).toBe(0);
    expect(state.fetchModels).not.toHaveBeenCalled();
  });
  it("does not send a custom gateway's key to the official OpenAI API", async () => {
    state.endpoint = "https://gateway.example.invalid/v1";
    expect((await loadProviderModels("openai")).error).toContain(
      "custom OpenAI gateways",
    );
    expect(state.fetchModels).not.toHaveBeenCalled();
  });
  it("does not fetch without credentials or erase scopes", async () => {
    await saveModelScope("anthropic", ["example-chat"]);
    state.secret = null;
    expect(await loadProviderModels("anthropic")).toMatchObject({
      scopedModels: ["example-chat"],
      stale: true,
    });
    expect(state.fetchModels).not.toHaveBeenCalled();
  });
  it("stores metadata only, not credentials", async () => {
    await loadProviderModels("anthropic");
    expect(JSON.stringify([...state.store.values()])).not.toContain(
      "example-credential",
    );
  });
});
