import { describe, expect, it } from "vitest";

import {
  buildAgentSettingsDestination,
  isLegacyAgentResourcesLocation,
} from "./agent-route";

describe("agent settings routes", () => {
  it("routes legacy Resources links to the Resources settings tab", () => {
    expect(buildAgentSettingsDestination("#resources", "?project=spec")).toBe(
      "/settings/agent/resources?project=spec",
    );
    expect(buildAgentSettingsDestination("#agent%3Aresources")).toBe(
      "/settings/agent/resources",
    );
  });

  it("identifies old Resources hashes on the settings route", () => {
    expect(
      isLegacyAgentResourcesLocation("/settings/agent", "#resources"),
    ).toBe(true);
    expect(
      isLegacyAgentResourcesLocation("/settings/agent/files", "#resources"),
    ).toBe(false);
    expect(isLegacyAgentResourcesLocation("/settings/agent", "#limits")).toBe(
      false,
    );
  });

  it("preserves other legacy agent destinations", () => {
    expect(buildAgentSettingsDestination("#files")).toBe(
      "/settings/agent/resources/files",
    );
    expect(buildAgentSettingsDestination("")).toBe("/settings/agent");
  });
});
