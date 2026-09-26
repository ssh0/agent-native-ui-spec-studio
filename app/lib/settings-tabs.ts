import type { SettingsTabItem } from "@agent-native/core/client/settings";
import { cloneElement, isValidElement, type ReactElement } from "react";

/**
 * The installed Core settings tab creates its Workspace panel without exposing
 * the connection-ownership switch in the public tab options. Scope Core's
 * existing switch to that panel so app API keys remain managed in API Keys.
 */
export function suppressWorkspaceConnectionPrompt(
  tab: SettingsTabItem,
): SettingsTabItem {
  if (tab.id !== "workspace" || !isValidElement(tab.content)) return tab;

  const content = tab.content as ReactElement<{
    builderConnectionOwnedExternally?: boolean;
  }>;
  return {
    ...tab,
    content: cloneElement(content, { builderConnectionOwnedExternally: true }),
  };
}
