import { describe, expect, it } from "vitest";

import { studioSettingsDestination } from "./settings-route";

describe("studio settings routes", () => {
  it("keeps provider setup links on the app-owned model panel", () => {
    expect(
      studioSettingsDestination(
        "/settings",
        "#ai-provider",
        "?provider=openai",
      ),
    ).toBe("/settings/agent?provider=openai#ai-provider");
  });
  it.each([
    ["/settings/integrations", ""],
    ["/settings/integrations/builder", ""],
    ["/settings/integrations/slack", ""],
    ["/settings", "#integrations"],
    ["/settings", "#connections"],
    ["/settings", "#browser"],
    ["/settings", "#integrations%3Abuilder"],
  ])("replaces legacy %s %s while preserving query context", (path, hash) => {
    expect(studioSettingsDestination(path, hash, "?project=example")).toBe(
      "/settings/studio-integrations?project=example",
    );
  });

  it.each([
    ["/settings/studio-integrations", ""],
    ["/settings", "#keys"],
    ["/settings/agent", "#resources"],
    ["/settings", "#%broken"],
  ])("leaves unrelated routes alone: %s %s", (path, hash) => {
    expect(studioSettingsDestination(path, hash, "")).toBeNull();
  });
});
