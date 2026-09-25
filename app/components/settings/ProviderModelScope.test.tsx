import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
  discovery: {} as Record<string, unknown>,
  save: {} as Record<string, unknown>,
}));
vi.mock("@agent-native/core/client/hooks", () => ({
  useActionQuery: () => state.query,
  useActionMutation: (name: string) =>
    name === "provider-model-catalog" ? state.discovery : state.save,
}));
import { ProviderModelScope } from "./ProviderModelScope";
const catalog = {
  provider: "openrouter",
  models: [
    {
      id: "example-chat",
      name: "Example chat",
      createdAt: "2026-09-01T00:00:00Z",
      weeklyRank: 1,
    },
  ],
  fetchedAt: "2026-09-01T01:00:00Z",
  stale: false,
  scopedModels: ["example-chat", "example-retired"],
};
const render = () =>
  renderToStaticMarkup(
    <ProviderModelScope
      provider="openrouter"
      fallbackModels={["example-fallback"]}
      currentModel="example-retired"
      ready
    />,
  );

describe("provider model settings rendered states", () => {
  beforeEach(() => {
    state.query = {
      data: { providers: [catalog] },
      isLoading: false,
      isError: false,
    };
    state.discovery = { isPending: false };
    state.save = { isPending: false };
  });
  it("renders checkboxes, attributed ranking, dates and retained missing selection", () => {
    const html = render();
    expect(html).toContain('role="checkbox"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("OpenRouter weekly #1");
    expect(html).toContain("Newest catalog entry");
    expect(html).toContain("Not in the catalog");
    expect(html).toContain("example-retired");
    expect(html).not.toContain("example-fallback");
  });
  it("labels date-free catalog ordering as name order", () => {
    state.query = {
      data: {
        providers: [
          {
            ...catalog,
            models: [{ id: "example-chat", name: "Example chat" }],
          },
        ],
      },
    };
    const html = render();
    expect(html).toContain("Name order (no catalog dates)");
    expect(html).not.toContain("Newest catalog entries");
    expect(html).not.toContain(">Name</option>");
  });
  it("shows pending and actionable catalog failure without erasing rows", () => {
    state.discovery = {
      isPending: true,
      data: { ...catalog, error: "Retry catalog refresh", stale: true },
    };
    const html = render();
    expect(html).toContain("Refreshing");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('role="alert"');
    expect(html).toContain("Example chat");
  });
  it("distinguishes an empty live catalog from fallback suggestions", () => {
    state.query = {
      data: { providers: [{ ...catalog, models: [], scopedModels: [] }] },
    };
    const html = renderToStaticMarkup(
      <ProviderModelScope
        provider="openrouter"
        fallbackModels={["example-fallback"]}
        ready
      />,
    );
    expect(html).toContain("No chat models returned");
    expect(html).not.toContain("example-fallback");
  });
  it("labels suggestions when the catalog has never loaded and shows scope-read retry", () => {
    state.query = { isError: true, isLoading: false };
    const html = render();
    expect(html).toContain("Showing built-in suggestions");
    expect(html).toContain("example-fallback");
    expect(html).toContain("Saved scope could not be loaded");
    expect(html).toContain("Retry");
  });
});
