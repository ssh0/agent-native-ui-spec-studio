import type { SettingsTabItem } from "@agent-native/toolkit/app/settings";
import type { ReactNode } from "react";

export const AI_SETTINGS_SEARCH_ENTRIES = [
  {
    id: "ai-provider",
    label: "AI provider",
    keywords:
      "model provider Anthropic OpenAI OpenRouter Gemini Groq Mistral Cohere",
    hash: "ai-provider",
  },
  {
    id: "agent-limits",
    label: "Agent Limits",
    keywords: "max iterations steps loop",
    hash: "limits",
  },
];

/**
 * Deployment settings belong to runtime configuration, not this app's settings.
 * Replace mixed shared panels rather than hiding their connection buttons.
 */
export function buildStudioSettingsTabs(
  tabs: SettingsTabItem[],
  content: {
    agent: ReactNode;
    integrations: ReactNode;
    usage: ReactNode;
    storage: ReactNode;
  },
): SettingsTabItem[] {
  return tabs.map((tab) => {
    if (tab.id === "workspace") {
      return {
        ...tab,
        label: "File uploads",
        keywords: "files uploads attachments storage s3 bucket",
        searchEntries: [],
        content: content.storage,
      };
    }
    if (tab.id === "agent") {
      return {
        ...tab,
        label: "AI & models",
        keywords: "AI provider model limits",
        searchEntries: AI_SETTINGS_SEARCH_ENTRIES,
        content: content.agent,
      };
    }
    if (tab.id === "integrations") {
      return {
        ...tab,
        id: "studio-integrations",
        keywords: "integrations connections mcp tools",
        searchEntries: [],
        content: content.integrations,
      };
    }
    if (tab.id === "usage") {
      return {
        ...tab,
        keywords: "usage tokens cost spend",
        searchEntries: [],
        content: content.usage,
      };
    }
    return tab;
  });
}
