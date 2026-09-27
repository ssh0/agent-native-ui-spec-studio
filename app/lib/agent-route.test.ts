import { describe, expect, it } from "vitest";

import {
  buildAgentSettingsDestination,
  getLegacyAgentResourcesDestination,
} from "./agent-route";

describe("agent settings routes", () => {
  it("routes legacy Resources links to the Resources settings tab", () => {
    expect(buildAgentSettingsDestination("#resources", "?project=spec")).toBe(
      "/settings/agent/resources?project=spec",
    );
    expect(buildAgentSettingsDestination("#agent%3Aresources")).toBe(
      "/settings/agent/resources",
    );
    expect(buildAgentSettingsDestination("#AGENT%3AResources")).toBe(
      "/settings/agent/resources",
    );
  });

  it("identifies old Resources hashes on the settings route", () => {
    expect(
      getLegacyAgentResourcesDestination(
        "/settings/agent",
        "#resources",
        "?project=spec",
      ),
    ).toBe("/settings/agent/resources?project=spec");
    expect(
      getLegacyAgentResourcesDestination("/settings/agent/files", "#resources"),
    ).toBeNull();
    expect(
      getLegacyAgentResourcesDestination("/settings/agent", "#limits"),
    ).toBeNull();
  });

  it("preserves other legacy agent destinations", () => {
    expect(buildAgentSettingsDestination("#files")).toBe(
      "/settings/agent/resources/files",
    );
    expect(buildAgentSettingsDestination("")).toBe("/settings/agent");
  });
});
