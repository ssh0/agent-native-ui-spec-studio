import { useT } from "@agent-native/core/client/i18n";
import { useSetPageTitle } from "@agent-native/toolkit/app-shell";
import { TeamPage } from "@agent-native/toolkit/app/org/TeamPage";
import {
  AccountSettingsCard,
  SettingsGroup,
  SettingsRow,
  SettingsTabsPage,
  useAgentSettingsTabs,
  type SettingsSearchEntry,
} from "@agent-native/toolkit/app/settings";
import { LanguagePicker } from "@agent-native/toolkit/app/shared";
import { useMemo } from "react";
import { Navigate, useLocation } from "react-router";

import { StudioAiSettings } from "@/components/settings/studio-settings-pages";
import { StudioIntegrationsSettings } from "@/components/settings/StudioIntegrationsSettings";
import { StudioStorageSettings } from "@/components/settings/StudioStorageSettings";
import { StudioThemePicker } from "@/components/settings/StudioThemePicker";
import { StudioUsageSettings } from "@/components/settings/StudioUsageSettings";
import { getLegacyAgentResourcesDestination } from "@/lib/agent-route";
import { APP_TITLE } from "@/lib/app-config";
import { studioSettingsDestination } from "@/lib/settings-route";
import { buildStudioSettingsTabs } from "@/lib/settings-tabs";

export function meta() {
  return [{ title: `Settings - ${APP_TITLE}` }];
}

export default function SettingsRoute() {
  const location = useLocation();
  const integrationsDestination = studioSettingsDestination(
    location.pathname,
    location.hash,
    location.search,
  );
  if (integrationsDestination)
    return <Navigate to={integrationsDestination} replace />;
  const legacyResourcesDestination = getLegacyAgentResourcesDestination(
    location.pathname,
    location.hash,
    location.search,
  );
  if (legacyResourcesDestination) {
    return <Navigate to={legacyResourcesDestination} replace />;
  }
  return <SettingsPage />;
}

function SettingsPage() {
  const t = useT();
  const agentSettingsTabs = useAgentSettingsTabs();
  const settingsTabs = buildStudioSettingsTabs(agentSettingsTabs, {
    agent: <StudioAiSettings />,
    integrations: <StudioIntegrationsSettings />,
    usage: <StudioUsageSettings />,
    storage: <StudioStorageSettings />,
  });
  useSetPageTitle(t("settings.title"));

  const generalSearchEntries = useMemo<SettingsSearchEntry[]>(
    () => [
      {
        id: "studio-theme",
        label: "テーマ",
        keywords: "theme appearance solarized flexoki github contrast",
        hash: "studio-theme",
      },
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
      appName={APP_TITLE}
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
              id="appearance"
              label="テーマ"
              control={<StudioThemePicker />}
            />
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
