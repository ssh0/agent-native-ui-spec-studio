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
  it("does not mutate fallback groups when pinning a custom selection", () => {
    const result = scopedModelGroups(
      groups,
      [{ ...catalog(null), fetchedAt: null }],
      "anthropic",
      "example-custom",
    );
    expect(groups[0].models).toEqual(["example-old"]);
    expect(result[0].models).toEqual(["example-custom", "example-old"]);
    expect(result[0].statusLabel).toContain("not in catalog");
  });
  it("applies Anthropic scopes to the legacy ai-sdk engine alias too", () => {
    const result = scopedModelGroups(
      [{ ...groups[0], engine: "ai-sdk:anthropic" }],
      [{ ...catalog([]), configured: true }],
      "ai-sdk:anthropic",
      "example-current",
    );
    expect(result).toHaveLength(1);
    expect(result[0].models).toEqual(["example-current"]);
  });
  it("uses live catalogs and scopes only the selected provider", () => {
    const result = scopedModelGroups(
      groups,
      [catalog(["example-new"])],
      "ai-sdk:openai",
      "example-other",
    );
    expect(result[0].models).toEqual(["example-new"]);
    expect(result[1]).toEqual(groups[1]);
    expect(groups[0].models).toEqual(["example-old"]);
  });
  it("null allows new discoveries while an empty scope hides every non-current model", () => {
    expect(
      scopedModelGroups(
        groups,
        [catalog(null)],
        "ai-sdk:openai",
        "example-other",
      )[0].models,
    ).toEqual(["example-new", "example-older"]);
    expect(
      scopedModelGroups(groups, [catalog([])], "anthropic", "example-old")[0]
        .models,
    ).toEqual(["example-old"]);
    expect(
      scopedModelGroups(
        groups,
        [catalog([])],
        "ai-sdk:openai",
        "example-other",
      )[0].models,
    ).toEqual([]);
  });
  it("retains a missing current ID without silently adding removed non-current IDs", () => {
    expect(
      scopedModelGroups(
        groups,
        [catalog(["example-removed", "example-new"])],
        "anthropic",
        "example-custom",
      )[0].models,
    ).toEqual(["example-custom", "example-new"]);
  });
  it("uses built-in suggestions only before a successful fetch, not after an empty response", () => {
    expect(
      scopedModelGroups(
        groups,
        [{ ...catalog(null), fetchedAt: null }],
        "ai-sdk:openai",
        "example-other",
      )[0].models,
    ).toEqual(["example-old"]);
    expect(
      scopedModelGroups(
        groups,
        [{ ...catalog(null), models: [] }],
        "ai-sdk:openai",
        "example-other",
      )[0].models,
    ).toEqual([]);
  });
  it("makes discovered configured providers visible even if Core curates them out", () => {
    const item = {
      ...catalog(null),
      provider: "groq" as const,
      label: "Groq",
      configured: true,
    };
    expect(
      scopedModelGroups(groups, [item], "anthropic", "example-old").find(
        (group) => group.engine === "ai-sdk:groq",
      )?.models,
    ).toEqual(["example-new", "example-older"]);
    expect(
      scopedModelGroups(
        groups,
        [{ ...item, configured: false }],
        "anthropic",
        "example-old",
      ),
    ).toHaveLength(2);
  });
});
