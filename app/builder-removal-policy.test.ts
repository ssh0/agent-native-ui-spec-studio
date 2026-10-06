import {
  buildSettingsSearchIndex,
  CORE_SETTINGS_PAGES,
  createSettingsBridge,
  isSettingsPageVisible,
  searchSettings,
  type SettingsPageContext,
} from "@agent-native/toolkit/app/settings";
import { describe, expect, it } from "vitest";

import { studioSettingsPages } from "./components/settings/studio-settings-pages";
import {
  isStudioIntegrationServer,
  studioIntegrationCatalog,
} from "./components/settings/StudioIntegrationsSettings";

const bridge = createSettingsBridge({});
const context: SettingsPageContext = {
  role: "owner",
  isOwner: true,
  isAdmin: true,
  hasOrganization: true,
  soloDeploymentAdmin: false,
  appId: "ui-spec-studio",
  labs: {},
  flags: {},
};

describe("studio settings policy", () => {
  const pages = new Map(CORE_SETTINGS_PAGES.map((page) => [page.id, page]));
  for (const page of studioSettingsPages()) pages.set(page.id, page);
  const visible = [...pages.values()].filter((page) =>
    isSettingsPageVisible(page, context, bridge),
  );

  it("replaces deployment infrastructure without hiding independent settings", () => {
    expect(pages.get("infra")?.component).not.toBe(
      CORE_SETTINGS_PAGES.find((page) => page.id === "infra")?.component,
    );
    for (const id of [
      "model",
      "api-keys",
      "studio-integrations",
      "usage",
      "members",
      "auth",
      "files",
      "channels",
      "mcp",
    ]) {
      expect(
        visible.some((page) => page.id === id),
        id,
      ).toBe(true);
    }
    expect(pages.get("model")?.component).not.toBe(
      CORE_SETTINGS_PAGES.find((page) => page.id === "model")?.component,
    );
    expect(pages.get("app")?.component).not.toBe(
      CORE_SETTINGS_PAGES.find((page) => page.id === "app")?.component,
    );
  });

  it("indexes retained controls but not removed setup/credit controls", () => {
    const index = buildSettingsSearchIndex(
      visible.map((page) => ({
        page,
        label: page.label ?? page.id,
        groupLabel: page.group,
        entries: page.searchEntries ?? [],
      })),
      (key) => key,
    );
    for (const query of [
      "builder",
      "hosting",
      "credits",
      "background agent",
      "design system intelligence",
    ]) {
      expect(searchSettings(index, query), query).toEqual([]);
    }
    expect(searchSettings(index, "AI provider").length).toBeGreaterThan(0);
    expect(searchSettings(index, "max iterations").length).toBeGreaterThan(0);
  });

  it("keeps non-Builder catalog integrations including Slack", () => {
    const catalog = studioIntegrationCatalog();
    expect(catalog.some((entry) => entry.id === "builder-cms")).toBe(false);
    expect(catalog.some((entry) => entry.id === "slack")).toBe(true);
    expect(catalog.length).toBeGreaterThan(10);
  });

  it.each([
    ["https://mcp.builder.io/mcp/publish", false],
    ["https://builder.io/mcp", false],
    ["https://MCP.BUILDER.IO/mcp", false],
    ["https://builder.io.example.com/mcp", true],
    ["https://example.com/mcp?ref=builder.io", true],
    ["stdio:custom", true],
  ])("filters stored integration %s without deleting it", (url, expected) => {
    expect(isStudioIntegrationServer({ url })).toBe(expected);
  });
});
