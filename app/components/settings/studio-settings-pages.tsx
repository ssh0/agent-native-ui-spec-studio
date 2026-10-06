import {
  AgentSettingsContent,
  CORE_SETTINGS_PAGES,
  registerSettingsPages,
  type SettingsPageDefinition,
} from "@agent-native/toolkit/app/settings";

import { AI_SETTINGS_SEARCH_ENTRIES } from "@/lib/settings-tabs";

import { ProviderModelSettings } from "./ProviderModelSettings";
import { StudioIntegrationsSettings } from "./StudioIntegrationsSettings";
import { StudioStorageSettings } from "./StudioStorageSettings";
import { StudioUsageSettings } from "./StudioUsageSettings";

export function StudioAiSettings() {
  return (
    <div
      className="mx-auto flex w-full max-w-2xl flex-col gap-8"
      id="ai-provider"
    >
      <ProviderModelSettings />
      <AgentSettingsContent sections={["limits"]} />
    </div>
  );
}

/**
 * The redesigned shell has its own core page registry: extraTabs alone cannot
 * remove its default infrastructure, connection or model panels.
 */
export function studioSettingsPages(): SettingsPageDefinition[] {
  return CORE_SETTINGS_PAGES.flatMap<SettingsPageDefinition>((page) => {
    switch (page.id) {
      case "infra":
        return [
          {
            ...page,
            labelKey: "agentChat.settingsShell.search.fileUploads",
            component: StudioStorageSettings,
            keywords: "files uploads attachments storage s3 bucket",
            searchEntries: [],
          },
        ];
      case "model":
        return [
          {
            ...page,
            component: StudioAiSettings,
            keywords: "AI provider model limits",
            searchEntries: AI_SETTINGS_SEARCH_ENTRIES.map(
              ({ hash, ...entry }) => ({
                ...entry,
                anchor: hash,
              }),
            ),
          },
        ];
      case "integrations":
        // Core appends a browser-automation search entry to its integrations id.
        // Use an app page id so removed capabilities cannot leak into search.
        return [
          {
            ...page,
            visible: () => false,
            legacyTabIds: [],
            searchEntries: [],
          },
          {
            ...page,
            id: "studio-integrations",
            component: StudioIntegrationsSettings,
            keywords: "integrations connections mcp tools",
            legacyTabIds: [
              "studio-integrations",
              "integrations",
              "connections",
            ],
            subpages: [],
            searchEntries: [],
          },
        ];
      case "usage":
        return [
          {
            ...page,
            component: StudioUsageSettings,
            keywords: "usage tokens cost spend",
            searchEntries: [],
          },
        ];
      case "app":
        // Keep the app's existing General content, not a second default-model picker.
        return [{ ...page, component: ({ bridge }) => <>{bridge.general}</> }];
      case "api-keys":
        return [
          {
            ...page,
            searchEntries: page.searchEntries?.map((entry) =>
              entry.id === "api-keys:managed"
                ? {
                    ...entry,
                    keywords:
                      "managed integrations oauth system tokens storage calendar",
                  }
                : entry,
            ),
          },
        ];
      default:
        return [];
    }
  });
}

registerSettingsPages(studioSettingsPages());
