import { describe, expect, it } from "vitest";

import { scopedModelGroups, type ProviderModels } from "./provider-models";

const groups = [
  {
    engine: "anthropic",
    label: "Anthropic",
    configured: true,
    models: ["example-old"],
  },
  {
    engine: "ai-sdk:openai",
    label: "OpenAI",
    configured: true,
    models: ["example-other"],
  },
];
function catalog(scope: string[] | null): ProviderModels {
  return {
    provider: "anthropic",
    models: [
      { id: "example-new", name: "New" },
      { id: "example-older", name: "Older" },
    ],
    fetchedAt: "2026-09-01T00:00:00Z",
    stale: false,
    scopedModels: scope,
  };
}
describe("scoped chat picker", () => {
  it("does not offer built-in models before a verified catalog is loaded", () => {
    const result = scopedModelGroups(groups, [
      { ...catalog(null), fetchedAt: null },
    ]);
    expect(groups[0].models).toEqual(["example-old"]);
    expect(result[0].models).toEqual([]);
  });
  it("hides Builder models while preserving the deferred Copilot group", () => {
    const result = scopedModelGroups(
      [
        ...groups,
        {
          engine: "builder",
          label: "Builder",
          configured: true,
          models: ["builder-standard"],
        },
        {
          engine: "github-copilot",
          label: "GitHub Copilot",
          configured: true,
          models: ["copilot-model"],
        },
      ],
      [],
    );
    expect(result.some((group) => group.engine === "builder")).toBe(false);
    expect(result.find((group) => group.engine === "github-copilot")?.models)
      .toEqual(["copilot-model"]);
  });
  it("applies Anthropic scopes to the legacy ai-sdk engine alias too", () => {
    const result = scopedModelGroups(
      [{ ...groups[0], engine: "ai-sdk:anthropic" }],
      [{ ...catalog([]), configured: true }],
    );
    expect(result).toHaveLength(1);
    expect(result[0].models).toEqual([]);
  });
  it("uses live catalogs and scopes only the selected provider", () => {
    const result = scopedModelGroups(groups, [catalog(["example-new"])]);
    expect(result[0].models).toEqual(["example-new"]);
    expect(result[1]).toEqual(groups[1]);
    expect(groups[0].models).toEqual(["example-old"]);
  });
  it("null allows new discoveries while an empty scope hides every model", () => {
    expect(scopedModelGroups(groups, [catalog(null)])[0].models).toEqual([
      "example-new",
      "example-older",
    ]);
    expect(scopedModelGroups(groups, [catalog([])])[0].models).toEqual([]);
  });
  it("does not add removed IDs outside the saved scope", () => {
    expect(
      scopedModelGroups(groups, [
        catalog(["example-removed", "example-new"]),
      ])[0].models,
    ).toEqual(["example-new"]);
  });
  it("offers no models before loading or after an empty catalog response", () => {
    expect(
      scopedModelGroups(groups, [{ ...catalog(null), fetchedAt: null }])[0]
        .models,
    ).toEqual([]);
    expect(
      scopedModelGroups(groups, [{ ...catalog(null), models: [] }])[0].models,
    ).toEqual([]);
  });
  it("offers explicitly scoped custom OpenAI IDs missing from Core's group", () => {
    const openaiGroup = {
      engine: "ai-sdk:openai",
      label: "OpenAI",
      configured: true,
      models: ["custom-model", "unselected-model"],
    };
    const customGateway: ProviderModels = {
      provider: "openai",
      models: [],
      fetchedAt: null,
      stale: true,
      preserveEngineModels: true,
      scopedModels: ["custom-model", "gateway-only-model"],
    };
    expect(scopedModelGroups([openaiGroup], [customGateway])[0].models).toEqual([
      "custom-model",
      "gateway-only-model",
    ]);
    expect(
      scopedModelGroups([openaiGroup], [
        { ...customGateway, scopedModels: null },
      ])[0].models,
    ).toEqual(["custom-model", "unselected-model"]);
    expect(
      scopedModelGroups([openaiGroup], [{ ...customGateway, scopedModels: [] }])[0]
        .models,
    ).toEqual([]);
    expect(
      scopedModelGroups(
        [{ ...openaiGroup, engine: "anthropic" }],
        [{ ...customGateway, provider: "anthropic" }],
      )[0].models,
    ).toEqual(["custom-model"]);
  });
  it("filters Ollama with its own checked scope", () => {
    const result = scopedModelGroups(
      [
        {
          engine: "ai-sdk:ollama",
          label: "Ollama",
          configured: true,
          models: ["example-default"],
        },
      ],
      [
        {
          ...catalog(["example-local"]),
          provider: "ollama",
          configured: true,
          models: [{ id: "example-local", name: "Local" }],
        },
      ],
    );
    expect(result[0].models).toEqual(["example-local"]);
  });
  it("makes discovered configured providers visible even if Core curates them out", () => {
    const item = {
      ...catalog(null),
      provider: "groq" as const,
      label: "Groq",
      configured: true,
    };
    expect(
      scopedModelGroups(groups, [item]).find(
        (group) => group.engine === "ai-sdk:groq",
      )?.models,
    ).toEqual(["example-new", "example-older"]);
    expect(
      scopedModelGroups(groups, [{ ...item, configured: false }]),
    ).toHaveLength(2);
  });
});
