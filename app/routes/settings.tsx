import { LanguagePicker, useT } from "@agent-native/core/client/i18n";
import {
  AccountSettingsCard,
  AgentSettingsContent,
  SettingsGroup,
  SettingsRow,
  SettingsTabsPage,
  useAgentSettingsTabs,
  type SettingsSearchEntry,
} from "@agent-native/core/client/settings";
import { TeamPage } from "@agent-native/core/client/team-page";
import { useSetPageTitle } from "@agent-native/toolkit/app-shell";
import { useMemo } from "react";

import { APP_TITLE } from "@/lib/app-config";
import { ProviderModelSettings } from "@/components/settings/ProviderModelSettings";

export function meta() {
  return [{ title: `Settings - ${APP_TITLE}` }];
}

export default function SettingsRoute() {
  const t = useT();
  const agentSettingsTabs = useAgentSettingsTabs();
  const settingsTabs = agentSettingsTabs.map((tab) =>
    tab.id === "agent"
      ? {
          ...tab,
          label: "AI & models",
          keywords: "AI provider model API key Anthropic OpenAI OpenRouter Gemini Groq Mistral Cohere",
          searchEntries: [
            { id: "ai-provider", label: "AI provider", keywords: "API key model", hash: "ai-provider" },
          ],
          content: (
            <div className="mx-auto w-full max-w-2xl space-y-8" id="ai-provider">
              <ProviderModelSettings />
              <AgentSettingsContent sections={["limits"]} />
            </div>
          ),
        }
      : tab,
  );
  useSetPageTitle(t("settings.title"));

  const generalSearchEntries = useMemo<SettingsSearchEntry[]>(
    () => [
      {
        id: "chat-language",
        label: t("settings.languageTitle"),
        keywords: "language locale translation i18n",
        hash: "language",
      },
    ],
    [t],
  );

  return (
    <SettingsTabsPage
      account={<AccountSettingsCard />}
      teamLabel={t("navigation.team")}
      extraTabs={settingsTabs}
      generalSearchEntries={generalSearchEntries}
      general={
        <div className="mx-auto w-full max-w-2xl space-y-6">
          <p className="text-sm leading-6 text-muted-foreground">
            {t("settings.description")}
          </p>

          <SettingsGroup>
            <SettingsRow
              id="language"
              label={t("settings.languageTitle")}
              description={t("settings.languageDescription")}
              control={
                <div className="w-56">
                  <LanguagePicker label={t("settings.languageLabel")} />
                </div>
              }
            />
          </SettingsGroup>
        </div>
      }
      team={
        <div className="mx-auto w-full max-w-3xl">
          <TeamPage
            showTitle={false}
            createOrgDescription={t("pages.teamCreateOrgDescription")}
          />
        </div>
      }
    />
  );
}
