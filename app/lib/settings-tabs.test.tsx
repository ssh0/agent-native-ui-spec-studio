import {
  getAgentSettingsSearchTabs,
  SettingsTabsPage,
  type SettingsTabItem,
} from "@agent-native/toolkit/app/settings";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { buildStudioSettingsTabs } from "./settings-tabs";

describe("studio settings tabs", () => {
  const content = {
    agent: createElement("section", null, "Provider settings"),
    integrations: createElement("section", null, "MCP connections"),
    usage: createElement("section", null, "Provider usage"),
    storage: createElement("section", null, "S3 configuration"),
  };

  it("removes deployment controls and replaces mixed shared panels including search", () => {
    const tabs: SettingsTabItem[] = getAgentSettingsSearchTabs("en-US").map(
      (tab) => ({
        ...tab,
        content: createElement("section", null, "Connect Builder"),
      }),
    );
    const selected = buildStudioSettingsTabs(tabs, content);
    expect(selected.find((tab) => tab.id === "workspace")?.content).toBe(
      content.storage,
    );
    for (const id of ["agent", "integrations", "usage"] as const) {
      const tab = selected.find(
        (item) =>
          item.id === (id === "integrations" ? "studio-integrations" : id),
      )!;
      expect(tab.content).toBe(content[id]);
      expect(renderToStaticMarkup(tab.content)).not.toContain(
        "Connect Builder",
      );
      expect(JSON.stringify(tab.searchEntries)).not.toMatch(
        /builder|hosting|database/i,
      );
    }
    expect(selected.find((tab) => tab.id === "agent")?.searchEntries).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "agent-limits" })]),
    );
  });

  it("renders the retained legacy shell without deployment or connection prompts", () => {
    const tabs: SettingsTabItem[] = getAgentSettingsSearchTabs("en-US").map(
      (tab) => ({
        ...tab,
        content: createElement("section", null, "Retained shared settings"),
      }),
    );
    const html = renderToStaticMarkup(
      createElement(SettingsTabsPage, {
        redesign: false,
        general: createElement("section", null, "App preferences"),
        extraTabs: buildStudioSettingsTabs(tabs, content),
        value: "studio-integrations",
      }),
    );
    expect(html).toContain("MCP connections");
    expect(html).toContain("AI &amp; models");
    expect(html).toContain("File uploads");
    expect(html).not.toMatch(/Connect Builder|Hosting|Database/);
  });

  it("preserves independent settings and does not mutate the source", () => {
    const tabs = [
      "keys",
      "mcp",
      "organization",
      "agent:resources",
      "agent:automations",
      "extensions",
    ].map((id) => ({
      id,
      label: id,
      content: createElement("section", null, id),
    }));
    expect(buildStudioSettingsTabs(tabs, content)).toEqual(tabs);
    for (const [i, tab] of buildStudioSettingsTabs(tabs, content).entries()) {
      expect(tab).toBe(tabs[i]);
    }
  });
});
