import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
  discovery: {} as Record<string, unknown>,
  save: {} as Record<string, unknown>,
}));
vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({ checked }: { checked: boolean }) =>
    React.createElement("input", { type: "checkbox", checked, readOnly: true }),
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
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('checked=""');
    expect(html).toContain("OpenRouter weekly #1");
    expect(html).toContain("Newest catalog entry");
    expect(html).toContain("Not in the catalog");
    expect(html).toContain("example-retired");
    expect(html).not.toContain("example-fallback");
    expect(html).not.toContain("Refresh catalog");
    expect(html).not.toContain("Filter models");
    expect(html).not.toContain("Allow all models");
    expect(html).not.toContain("Clear selection");
  });
  it("shows a saved current selection outside the scope without offering it", () => {
    state.query = {
      data: { providers: [{ ...catalog, scopedModels: ["example-chat"] }] },
    };
    const html = render();
    expect(html).toContain("Current selection · Outside scope");
    const currentRow = html.slice(
      html.indexOf("example-retired") - 300,
      html.indexOf("example-retired") + 200,
    );
    expect(currentRow).not.toContain("checked=");
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
    expect(html).toContain("Loading the provider’s model catalog");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('role="alert"');
    expect(html).toContain("Example chat");
  });
  it("distinguishes an empty live catalog from an unverified fallback", () => {
    state.query = {
      data: { providers: [{ ...catalog, models: [], scopedModels: [] }] },
    };
    const html = renderToStaticMarkup(
      <ProviderModelScope provider="openrouter" ready />,
    );
    expect(html).toContain("No chat models returned");
    expect(html).not.toContain("example-fallback");
  });
  it("shows an unloaded catalog and scope-read retry without fallback candidates", () => {
    state.query = { isError: true, isLoading: false };
    const html = render();
    expect(html).toContain("Model catalog has not been loaded yet.");
    expect(html).not.toContain("example-fallback");
    expect(html).not.toContain('type="checkbox"');
    expect(html).toContain("Saved scope could not be loaded");
    expect(html).toContain("Retry");
  });
});
